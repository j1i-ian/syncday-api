import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { GoogleOAuth2UserWithToken } from '@interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { SyncdayOAuth2TokenResponse } from '@interfaces/auth/syncday-oauth2-token-response.interface';
import { OAuth2TokenService } from '@services/integrations/oauth2-token-service.interface';
import { IntegrationsValidator } from '@services/integrations/integrations.validator';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { OAuth2Converter } from '@services/integrations/oauth2-converter.interface';
import { CoreGoogleConverterService } from '@services/converters/google/core-google-converter.service';
import { User } from '@entities/users/user.entity';
import { OAuth2Account } from '@entities/users/oauth2-account.entity';
import { Profile } from '@entities/profiles/profile.entity';
import { TeamSetting } from '@entities/teams/team-setting.entity';

@Injectable()
export class GoogleOAuth2TokenService implements OAuth2TokenService {

    constructor(
        private readonly oauth2AccountsService: OAuth2AccountsService,
        private readonly integrationsServiceLocator: IntegrationsServiceLocator,
        private readonly integrationsValidator: IntegrationsValidator,
        private readonly googleIntegrationFacade: GoogleIntegrationFacade,
        private readonly coreGoogleConverterService: CoreGoogleConverterService,
        private readonly googleIntegrationService: GoogleIntegrationsService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    generateOAuth2AuthoizationUrl(
        integrationContext: IntegrationContext,
        timezone: string | null,
        decodedUserOrNull: User | null
    ): string {
        return this.googleIntegrationFacade.generateGoogleOAuthAuthoizationUrl(
            integrationContext,
            decodedUserOrNull,
            timezone
        );
    }

    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponse: SyncdayOAuth2TokenResponse
    ): string {
        return this.googleIntegrationService.generateOAuth2RedirectURI(syncdayGoogleOAuthTokenResponse);
    }

    async getOAuth2UserProfile(
        authorizationCode: string
    ): Promise<GoogleOAuth2UserWithToken> {
        const googleOAuth2UserWithToken =
            await this.googleIntegrationFacade.fetchGoogleUsersWithToken(authorizationCode, {
                onlyPrimaryCalendarSchedule: true
            });

        return googleOAuth2UserWithToken;
    }

    async multipleSocialSignIn(
        user: User,
        ensuredRequesterEmail: string
    ): Promise<void> {
        await this.oauth2AccountsService.create(user, {
            email: ensuredRequesterEmail,
            oauth2Type: OAuth2Type.GOOGLE
        } as OAuth2Account);
    }

    async integrate(
        oauth2UserProfile: GoogleOAuth2UserWithToken,
        user: User,
        profile: Profile,
        teamSetting: TeamSetting
    ): Promise<void> {

        this.logger.info({
            message: 'Start to Integrate with Google',
            userId: user.id,
            profileId: profile.id
        });

        const { calendars, tokens, schedules } = oauth2UserProfile;

        const newGoogleCalendarIntegrations = this.coreGoogleConverterService.convertToGoogleCalendarIntegration(calendars);

        const googleUserEmail = this.getEmailFromOAuth2UserProfile(oauth2UserProfile);

        await this.integrationsValidator.validateMaxAddLimit(
            this.integrationsServiceLocator,
            user.id
        );

        this.logger.info({
            message: 'Passed validateMaxAddLimit',
            userId: user.id,
            profileId: profile.id
        });

        const hasOutboundCalendar = await this.integrationsValidator.hasOutboundCalendar(
            this.integrationsServiceLocator,
            user.id
        );
        const isFirstIntegration = !hasOutboundCalendar;

        this.logger.info({
            message: 'Passed hasOutboundCalendar',
            userId: user.id,
            profileId: profile.id
        });

        await this.googleIntegrationService.create(
            profile,
            teamSetting,
            user,
            user.userSetting,
            tokens,
            newGoogleCalendarIntegrations,
            {
                googleUserEmail,
                calendars,
                schedules
            },
            {
                isFirstIntegration
            }
        );

        this.logger.info({
            message: 'Google Integration is created sucessfully',
            userId: user.id,
            profileId: profile.id
        });
    }

    getEmailFromOAuth2UserProfile(
        oauth2UserProfile: GoogleOAuth2UserWithToken
    ): string {
        return oauth2UserProfile.googleUser.email;
    }

    get converter(): OAuth2Converter {
        return this.coreGoogleConverterService;
    }
}
