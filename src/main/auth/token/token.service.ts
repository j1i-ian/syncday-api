import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { oauth2_v2 } from 'googleapis';
import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { UserService } from '@services/users/user.service';
import { OAuth2TokenServiceLocator } from '@services/oauth2/oauth2-token.service-locator';
import { UtilService } from '@services/util/util.service';
import { User } from '@entity/users/user.entity';
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
        private readonly oauth2TokenServiceLocator: OAuth2TokenServiceLocator
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

        const decodedUserOrNull: User | null = accessToken
            ? this.jwtService.decode(accessToken) as User
            : null;

        const oauth2TokenService = this.oauth2TokenServiceLocator.get(integrationVendor);

        return oauth2TokenService.generateOAuth2AuthoizationUrl(
            integrationContext,
            timezone,
            decodedUserOrNull
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
        timezone: string,
        integrationContext: IntegrationContext,
        requestUserEmail: string | null,
        language: Language
    ): Promise<SyncdayOAuth2TokenResponse> {
        const oauth2TokenService = this.oauth2TokenServiceLocator.get(integrationVendor);

        const oauth2UserProfile = await oauth2TokenService.getOAuth2UserProfile(authorizationCode);

        const oauth2UserEmail = oauth2TokenService.getEmailFromOAuth2UserProfile(oauth2UserProfile);

        const ensuredRequesterEmail = requestUserEmail || oauth2UserEmail;

        const ensuredIntegrationContext = await this.evaluateIntegrationContext(
            integrationVendor,
            oauth2UserProfile,
            integrationContext,
            ensuredRequesterEmail
        );

        let isNewbie: boolean;

        let user: User | null = await this.userService.findUserByEmail(ensuredRequesterEmail);

        this.validateOAuth2Request(user, ensuredIntegrationContext);

        const insufficientPermission = oauth2UserProfile.insufficientPermission;

        switch (ensuredIntegrationContext) {
            case IntegrationContext.SIGN_UP:
                user = await oauth2TokenService.signUpWithOAuth(
                    timezone,
                    oauth2UserProfile,
                    language
                );
                isNewbie = true;
                break;
            case IntegrationContext.SIGN_IN:
                isNewbie = false;
                break;
            case IntegrationContext.INTEGRATE:
                await oauth2TokenService.integrate(
                    oauth2UserProfile,
                    user as User
                );
                isNewbie = false;
                break;
            case IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN:
                await oauth2TokenService.multipleSocialSignIn(
                    user as User,
                    ensuredRequesterEmail
                );
                isNewbie = false;
                break;
            default:
                throw new InternalServerErrorException('Unknown integration context');
        }

        const issuedToken = this.issueToken(user as User);

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

    issueTokenByRefreshToken(refreshToken: string): CreateTokenResponseDto {

        const decoedUserByRefreshToken: User = this.jwtService.verify(refreshToken, {
            secret: this.jwtRefreshTokenOption.secret
        });

        return this.issueToken(decoedUserByRefreshToken);
    }

    issueToken(user: User): CreateTokenResponseDto {
        const signedAccessToken = this.jwtService.sign(
            {
                id: user.id,
                uuid: user.uuid,
                email: user.email,
                profileImage: user.profileImage,
                name: user.name,
                userSettingId: user.userSettingId
            } as Partial<User>,
            {
                secret: this.jwtOption.secret,
                expiresIn: this.jwtOption.signOptions?.expiresIn
            }
        );

        const signedRefreshToken =  this.jwtService.sign(
            {
                id: user.id,
                uuid: user.uuid,
                email: user.email,
                profileImage: user.profileImage,
                name: user.name,
                userSettingId: user.userSettingId
            } as Partial<User>,
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
        oauth2UserProfile: OAuth2UserProfile,
        requestIntegrationContext: IntegrationContext,
        ensuredUserEmail: string
    ): Promise<IntegrationContext> {

        const oauth2TokenService = this.oauth2TokenServiceLocator.get(integrationVendor);

        const oauth2UserEmail = oauth2TokenService.getEmailFromOAuth2UserProfile(oauth2UserProfile);

        const loadedUserOrNull = await this.userService.findUserByEmail(ensuredUserEmail);

        const loadedOAuth2AccountOrNull = loadedUserOrNull?.oauth2Accounts.find(
            (_oauthAccount) => _oauthAccount.email === oauth2UserEmail
        ) ?? null;

        const loadedIntegrationOrNull = oauth2TokenService.getIntegrationFromUser(
            loadedUserOrNull,
            oauth2UserEmail
        );

        const ensuredIntegrationContext = this.utilService.ensureIntegrationContext(
            requestIntegrationContext,
            loadedUserOrNull,
            loadedOAuth2AccountOrNull,
            loadedIntegrationOrNull
        );

        return ensuredIntegrationContext;
    }
}
