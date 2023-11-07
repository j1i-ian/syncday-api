import { Inject, Injectable, InternalServerErrorException, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { calendar_v3, oauth2_v2 } from 'googleapis';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { UtilService } from '@services/util/util.service';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { IntegrationsValidator } from '@services/integrations/integrations.validator';
import { User } from '@entity/users/user.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { OAuth2Type } from '@entity/users/oauth2-type.enum';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { Language } from '@app/enums/language.enum';
import { SyncdayGoogleOAuthTokenResponse } from '@app/interfaces/auth/syncday-google-oauth-token-response.interface';
import { AppConfigService } from '../../../configs/app-config.service';
import { UserService } from '../../services/users/user.service';

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
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        private readonly oauth2AccountsService: OAuth2AccountsService,
        private readonly integrationsServiceLocator: IntegrationsServiceLocator,
        private readonly integrationsValidator: IntegrationsValidator,
        private readonly googleIntegrationFacade: GoogleIntegrationFacade,
        private readonly googleIntegrationService: GoogleIntegrationsService,
        private readonly googleConverterService: GoogleConverterService,
        private readonly notificationsService: NotificationsService
    ) {
        this.jwtOption = AppConfigService.getJwtOptions(this.configService);
        this.jwtRefreshTokenOption = AppConfigService.getJwtRefreshOptions(this.configService);
    }

    jwtOption: JwtModuleOptions;
    jwtRefreshTokenOption: JwtModuleOptions;

    generateGoogleOAuthAuthoizationUrl(
        integrationContext: IntegrationContext,
        timezone: string | null,
        accessToken: string | null
    ): string {

        const decodedUserOrNull: User | null = accessToken
            ? this.jwtService.decode(accessToken) as User
            : null;

        return this.googleIntegrationFacade.generateGoogleOAuthAuthoizationUrl(
            integrationContext,
            decodedUserOrNull,
            timezone
        );
    }

    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponse: SyncdayGoogleOAuthTokenResponse
    ): string {
        return this.googleIntegrationService.generateOAuth2RedirectURI(syncdayGoogleOAuthTokenResponse);
    }

    async issueTokenByGoogleOAuth(
        authorizationCode: string,
        timezone: string,
        integrationContext: IntegrationContext,
        requestUserEmail: string | null,
        language: Language
    ): Promise<SyncdayGoogleOAuthTokenResponse> {
        const { googleUser, calendars, schedules, tokens, insufficientPermission } =
            await this.googleIntegrationFacade.fetchGoogleUsersWithToken(authorizationCode, {
                onlyPrimaryCalendarSchedule: true
            });
        const googleUserEmail = googleUser.email;

        const ensuredRequesterEmail = requestUserEmail || googleUser.email;

        let loadedUserOrNull = await this.userService.findUserByEmail(ensuredRequesterEmail);
        const loadedOAuth2AccountOrNull = loadedUserOrNull?.oauth2Accounts.find(
            (_oauthAccount) => _oauthAccount.email === googleUser.email
        ) ?? null;
        const loadedIntegrationOrNull = loadedUserOrNull?.googleIntergrations.find(
            (_googleIntegration) => _googleIntegration.email === googleUser.email
        ) ?? null;

        const ensuredIntegrationContext = this.utilService.ensureIntegrationContext(
            integrationContext,
            loadedUserOrNull,
            loadedOAuth2AccountOrNull,
            loadedIntegrationOrNull
        );

        const newGoogleCalendarIntegrations = this.googleConverterService.convertToGoogleCalendarIntegration(calendars);

        let isNewbie = false;

        if (ensuredIntegrationContext === IntegrationContext.SIGN_UP) {
            const primaryGoogleCalendar = calendars?.items.find((_cal) => _cal.primary) as calendar_v3.Schema$CalendarListEntry;
            const ensuredTimezone = timezone || primaryGoogleCalendar?.timeZone as string;

            const createUserRequestDto: CreateUserRequestDto = {
                email: googleUser.email,
                name: googleUser.name,
                timezone: ensuredTimezone
            };

            loadedUserOrNull = await this.userService.createUserByGoogleOAuth2(
                createUserRequestDto,
                tokens,
                newGoogleCalendarIntegrations,
                {
                    googleUserEmail,
                    calendars,
                    schedules
                },
                language,
                {
                    isFirstIntegration: true
                }
            );

            isNewbie = true;

            await this.notificationsService.sendWelcomeEmailForNewUser(loadedUserOrNull.name, loadedUserOrNull.email, loadedUserOrNull.userSetting.preferredLanguage);

        } else if (ensuredIntegrationContext === IntegrationContext.SIGN_IN) {
            isNewbie = false;
        } else if (ensuredIntegrationContext === IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN) {
            isNewbie = false;

            const ensuredUser = loadedUserOrNull as User;

            const newOAuth2Account = {
                email: ensuredRequesterEmail,
                oauth2Type: OAuth2Type.GOOGLE
            } as OAuth2Account;

            await this.oauth2AccountsService.create(ensuredUser, newOAuth2Account);
        } else if (ensuredIntegrationContext === IntegrationContext.INTEGRATE) {
            // when integrationContext is integrationContext.Integrate
            const ensuredUser = loadedUserOrNull as User;

            await this.integrationsValidator.validateMaxAddLimit(
                this.integrationsServiceLocator,
                ensuredUser.id
            );

            await this.googleIntegrationService.create(
                ensuredUser,
                ensuredUser.userSetting,
                tokens,
                newGoogleCalendarIntegrations,
                {
                    googleUserEmail,
                    calendars,
                    schedules
                },
                {
                    isFirstIntegration: false
                }
            );

            isNewbie = false;
        } else {
            throw new InternalServerErrorException('Unknown integration context');
        }

        const issuedToken = this.issueToken(loadedUserOrNull as User);
        return { issuedToken, isNewbie, insufficientPermission };
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

    comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return compare(plainPassword, hashedPassword);
    }
}
