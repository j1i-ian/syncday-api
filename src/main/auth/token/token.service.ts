import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { oauth2_v2 } from 'googleapis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Observable, concatMap, firstValueFrom, map, of, tap } from 'rxjs';
import { OAuth2AccountUserProfileMetaInfo } from '@core/interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { SyncdayOAuth2StateParams } from '@core/interfaces/integrations/syncday-oauth2-state-params.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { UserService } from '@services/users/user.service';
import { OAuth2TokenServiceLocator } from '@services/oauth2/oauth2-token.service-locator';
import { UtilService } from '@services/util/util.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { Language } from '@app/enums/language.enum';
import { SyncdayOAuth2TokenResponse } from '@app/interfaces/auth/syncday-oauth2-token-response.interface';
import { AlreadySignedUpEmailException } from '@app/exceptions/already-signed-up-email.exception';
import { CannotFindMatchedUser } from '@app/exceptions/users/cannot-find-matched-user.exception';
import { AppConfigService } from '../../../configs/app-config.service';

export interface EnsuredGoogleTokenResponse {
    accessToken: string;
    refreshToken: string;
}

export type EnsuredGoogleOAuth2User = oauth2_v2.Schema$Userinfo &
EnsuredGoogleTokenResponse & {
    email: string;
    name: string;
    picture: string;
};

@Injectable()
export class TokenService {
    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        private readonly utilService: UtilService,
        private readonly userService: UserService,
        private readonly profileService: ProfilesService,
        private readonly oauth2TokenServiceLocator: OAuth2TokenServiceLocator,
        private readonly notificationsService: NotificationsService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {
        this.jwtOption = AppConfigService.getJwtOptions(this.configService);
        this.jwtRefreshTokenOption = AppConfigService.getJwtRefreshOptions(this.configService);
    }

    jwtOption: JwtModuleOptions;
    jwtRefreshTokenOption: JwtModuleOptions;

    generateOAuth2AuthoizationUrl(
        integrationVendor: IntegrationVendor,
        integrationContext: IntegrationContext,
        timezone: string | null,
        accessToken: string | null
    ): string {

        const decodedAppJwtPayloadOrNull: AppJwtPayload | null = accessToken
            ? this.jwtService.decode(accessToken) as AppJwtPayload
            : null;

        const oauth2TokenService = this.oauth2TokenServiceLocator.get(integrationVendor);

        return oauth2TokenService.generateOAuth2AuthoizationUrl(
            integrationContext,
            timezone,
            decodedAppJwtPayloadOrNull
        );
    }

    generateOAuth2RedirectURI(
        integrationVendor: IntegrationVendor,
        syncdayGoogleOAuthTokenResponse: SyncdayOAuth2TokenResponse
    ): string {
        const oauth2TokenService = this.oauth2TokenServiceLocator.get(integrationVendor);

        return oauth2TokenService.generateOAuth2RedirectURI(syncdayGoogleOAuthTokenResponse);
    }

    async issueTokenByOAuth2(
        integrationVendor: IntegrationVendor,
        authorizationCode: string,
        stateParams: SyncdayOAuth2StateParams,
        language: Language
    ): Promise<SyncdayOAuth2TokenResponse> {

        const {
            timezone,
            integrationContext,
            requestUserEmail,
            profileId: profileIdString
        } = stateParams;

        /**
         * Profile id will be integrated with resource.
         * e.g. Google Calendar
         */
        const profileId = profileIdString ? +profileIdString : null;

        this.logger.info({
            message: 'Start issue token by oauth2',
            requestUserEmail,
            integrationContext,
            profileId
        });

        const oauth2TokenService = this.oauth2TokenServiceLocator.get(integrationVendor);

        this.logger.info({
            message: 'Attempt to retrieve the OAuth2 user profile',
            requestUserEmail,
            integrationContext
        });
        const oauth2UserProfile = await oauth2TokenService.getOAuth2UserProfile(authorizationCode);

        this.logger.debug({
            message: 'OAuth2 user profile is fetched',
            oauth2UserProfile
        });

        const oauth2UserEmail = oauth2TokenService.getEmailFromOAuth2UserProfile(oauth2UserProfile);
        const oauth2UserPhoneNumber = oauth2TokenService.getPhoneNumberFromOAuth2UserProfile(oauth2UserProfile);

        const ensuredRequesterEmail = requestUserEmail || oauth2UserEmail;

        this.logger.info({
            message: 'Evaluate integration context',
            requestUserEmail,
            integrationContext
        });
        const ensuredIntegrationContext = await this.evaluateIntegrationContext(
            integrationVendor,
            oauth2UserProfile,
            integrationContext,
            {
                ensuredUserEmail: ensuredRequesterEmail,
                ensuredUserPhoneNumber: oauth2UserPhoneNumber
            }
        );

        this.logger.info({
            message: 'integration context evaluation is done',
            requestUserEmail,
            integrationContext,
            ensuredIntegrationContext
        });

        let isNewbie: boolean;

        let user: User | null = await this.userService.findUserByLocalAuth({
            email: ensuredRequesterEmail,
            phone: oauth2UserPhoneNumber
        });

        let profile = user?.profiles.find((_profile) => _profile.id === profileId && profileId !== null) as Profile | null;
        let team = profile?.team as Team | null;

        this.validateOAuth2Request(user, ensuredIntegrationContext);

        const insufficientPermission = oauth2UserProfile.insufficientPermission;

        switch (ensuredIntegrationContext) {
            case IntegrationContext.SIGN_UP:
                // TODO: it should be migrated to user service.
                await firstValueFrom(
                    this.userService.createUser(
                        integrationVendor,
                        oauth2UserProfile,
                        timezone,
                        language
                    ).pipe(
                        tap(({ createdProfile, createdTeam, createdUser }) => {
                            profile = createdProfile;
                            user = createdUser;
                            team = createdTeam;
                        }),
                        concatMap(({ createdProfile, createdUser }) =>
                            this.notificationsService.sendWelcomeEmailForNewUser(
                                createdProfile.name,
                                createdUser.email as string,
                                createdUser.userSetting.preferredLanguage
                            )
                        )
                    )
                );

                isNewbie = true;

                break;
            case IntegrationContext.SIGN_IN:
                /**
                 * Ensure patch for Kakaotalk OAuth2
                 */
                profile = profile ?? user?.profiles[0] ?? null;
                team = profile?.team ?? null;
                isNewbie = false;

                this.logger.debug({
                    message: 'OAuth sign in',
                    user,
                    profile,
                    team,
                    isNewbie
                });
                break;
            case IntegrationContext.INTEGRATE:
                await oauth2TokenService.integrate(
                    oauth2UserProfile,
                    user as User,
                    profile as Profile,
                    (team as Team).teamSetting
                );
                isNewbie = false;
                break;
            case IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN:

                profile = profile ?? user?.profiles[0] as Profile;
                team = profile?.team ?? null;

                this.logger.info({
                    message: 'Multiple signed in',
                    ensuredRequesterEmail,
                    profileId: profile.id,
                    teamId: team.id
                });

                await oauth2TokenService.multipleSocialSignIn(
                    user as User,
                    ensuredRequesterEmail
                );
                isNewbie = false;
                break;
            default:
                throw new InternalServerErrorException('Unknown integration context');
        }

        const ensuredUserSettingId = user?.userSetting.id as number;
        const issuedToken = this.issueToken(
            profile as Profile,
            user as User,
            team as Team,
            ensuredUserSettingId
        );

        return {
            issuedToken,
            isNewbie,
            insufficientPermission
        };
    }

    validateOAuth2Request(
        user: User | null,
        ensuredIntegrationContext: IntegrationContext
    ): void {

        if (user && ensuredIntegrationContext === IntegrationContext.SIGN_UP) {
            throw new AlreadySignedUpEmailException();
        } else if (user === null && ensuredIntegrationContext !== IntegrationContext.SIGN_UP) {
            throw new CannotFindMatchedUser();
        }
    }

    issueTokenByRefreshToken(
        refreshToken: string,
        teamId?: number,
        userId?: number
    ): Observable<CreateTokenResponseDto> {

        const decoedProfileByRefreshToken: AppJwtPayload = this.jwtService.verify(refreshToken, {
            secret: this.jwtRefreshTokenOption.secret
        });

        const isNewProfileTokenRequest = teamId && userId && decoedProfileByRefreshToken.userId === userId;

        this.logger.info({
            decoedProfileByRefreshToken,
            teamId,
            userId,
            isNewProfileTokenRequest
        });

        const decoedProfileByRefreshToken$ = isNewProfileTokenRequest ?
            this.profileService.fetch({
                teamId,
                userId
            })
            :  of(decoedProfileByRefreshToken as Partial<Profile>);

        return decoedProfileByRefreshToken$.pipe(
            map((_decoedProfileByRefreshToken) => {

                const switchedTeam = _decoedProfileByRefreshToken.team as Team;

                this.logger.debug({
                    _decoedProfileByRefreshToken,
                    switchedTeam
                });

                const extractedProfile = _decoedProfileByRefreshToken;
                const extractedUser = {
                    id: decoedProfileByRefreshToken.userId,
                    uuid: decoedProfileByRefreshToken.userUUID,
                    email: decoedProfileByRefreshToken.email
                } as Pick<User, 'id' | 'uuid' | 'email'>;
                const extractedTeam = {
                    id: switchedTeam.id,
                    uuid: switchedTeam.uuid
                } as Pick<Team, 'id' | 'uuid'>;
                const extractedUserSettingId = decoedProfileByRefreshToken.userSettingId;

                const tokenResponse = this.issueToken(
                    extractedProfile as Profile,
                    extractedUser as User,
                    extractedTeam as Team,
                    extractedUserSettingId
                );

                return tokenResponse;
            })
        );

    }

    issueToken(
        profile: Profile,
        user: Pick<User, 'id' | 'uuid' | 'email'>,
        team: Pick<Team, 'id' | 'uuid'>,
        userSettingId: number
    ): CreateTokenResponseDto {

        const appJwtPayload: AppJwtPayload = {
            id: profile.id,
            uuid: profile.uuid,
            name: profile.name,
            userId: user.id,
            userUUID: user.uuid,
            email: user.email,
            userSettingId,
            image: profile.image,
            roles: profile.roles,
            teamId: team.id,
            teamUUID: team.uuid
        } as AppJwtPayload & Partial<Profile>;

        const signedAccessToken = this.jwtService.sign(
            appJwtPayload,
            {
                secret: this.jwtOption.secret,
                expiresIn: this.jwtOption.signOptions?.expiresIn
            }
        );

        const signedRefreshToken =  this.jwtService.sign(
            appJwtPayload,
            {
                secret: this.jwtRefreshTokenOption.secret,
                expiresIn: this.jwtRefreshTokenOption.signOptions?.expiresIn
            }
        );

        return {
            accessToken: signedAccessToken,
            refreshToken: signedRefreshToken
        };
    }

    async evaluateIntegrationContext(
        integrationVendor: IntegrationVendor,
        oauth2UserProfile: OAuth2AccountUserProfileMetaInfo,
        requestIntegrationContext: IntegrationContext,
        {
            ensuredUserEmail,
            ensuredUserPhoneNumber
        }: {
            ensuredUserEmail?: string | null;
            ensuredUserPhoneNumber?: string | null;
        }
    ): Promise<IntegrationContext> {

        const oauth2Type = this.utilService.convertIntegrationVendorToOAuth2Type(integrationVendor);
        const oauth2TokenService = this.oauth2TokenServiceLocator.get(integrationVendor);

        const oauth2UserEmail = oauth2TokenService.getEmailFromOAuth2UserProfile(oauth2UserProfile);

        const loadedUserOrNull = await this.userService.findUserByLocalAuth({
            email: ensuredUserEmail,
            phone: ensuredUserPhoneNumber
        });

        const loadedOAuth2AccountOrNull = loadedUserOrNull?.oauth2Accounts.find(
            (_oauthAccount) => _oauthAccount.email === oauth2UserEmail &&
                _oauthAccount.oauth2Type === oauth2Type
        ) ?? null;

        const ensuredIntegrationContext = this.utilService.ensureIntegrationContext(
            requestIntegrationContext,
            loadedUserOrNull,
            loadedOAuth2AccountOrNull
        );

        return ensuredIntegrationContext;
    }
}
