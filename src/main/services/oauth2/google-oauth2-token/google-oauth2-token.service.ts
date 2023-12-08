import { Injectable } from '@nestjs/common';
import { calendar_v3 } from 'googleapis';
import { GoogleOAuth2UserWithToken } from '@core/interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { OAuth2TokenService } from '@services/integrations/oauth2-token-service.interface';
import { IntegrationsValidator } from '@services/integrations/integrations.validator';
import { UserService } from '@services/users/user.service';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { CreatedUserAndTeam } from '@services/users/created-user-and-team.interface';
import { User } from '@entity/users/user.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { Language } from '@app/enums/language.enum';
import { SyncdayOAuth2TokenResponse } from '@app/interfaces/auth/syncday-oauth2-token-response.interface';

@Injectable()
export class GoogleOAuth2TokenService implements OAuth2TokenService {

    constructor(
        private readonly oauth2AccountsService: OAuth2AccountsService,
        private readonly integrationsServiceLocator: IntegrationsServiceLocator,
        private readonly integrationsValidator: IntegrationsValidator,
        private readonly userService: UserService,
        private readonly googleIntegrationFacade: GoogleIntegrationFacade,
        private readonly googleConverterService: GoogleConverterService,
        private readonly googleIntegrationService: GoogleIntegrationsService,
        private readonly notificationsService: NotificationsService
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

    async signUpWithOAuth(
        timezone: string,
        oauth2UserProfile: GoogleOAuth2UserWithToken,
        language: Language
    ): Promise<CreatedUserAndTeam> {

        const { googleUser, calendars, tokens, schedules } = oauth2UserProfile;

        const newGoogleCalendarIntegrations = this.googleConverterService.convertToGoogleCalendarIntegration(calendars);
        const googleUserEmail = googleUser.email;

        const primaryGoogleCalendar = calendars?.items.find((_cal) => _cal.primary) as calendar_v3.Schema$CalendarListEntry;
        const ensuredTimezone = timezone || primaryGoogleCalendar?.timeZone as string;

        const createUserRequestDto: CreateUserRequestDto = {
            email: googleUser.email,
            name: googleUser.name,
            timezone: ensuredTimezone
        };

        const createdUserAndTeam = await this.userService.createUserByOAuth2(
            OAuth2Type.GOOGLE,
            createUserRequestDto,
            tokens,
            {
                oauth2UserEmail: googleUserEmail,
                oauth2UserProfileImageUrl: googleUser.picture
            },
            language,
            {
                googleCalendarIntegrations: newGoogleCalendarIntegrations,
                googleIntegrationBody: {

                    googleUserEmail,
                    calendars,
                    schedules
                },
                options: {
                    isFirstIntegration: true
                }
            }
        );
        const {
            createdUser: signedUpUser,
            createdProfile: signedUpProfile
        } = createdUserAndTeam;

        await this.notificationsService.sendWelcomeEmailForNewUser(
            signedUpProfile.name,
            signedUpUser.email,
            signedUpUser.userSetting.preferredLanguage
        );

        return createdUserAndTeam;
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

        const { calendars, tokens, schedules } = oauth2UserProfile;

        const newGoogleCalendarIntegrations = this.googleConverterService.convertToGoogleCalendarIntegration(calendars);

        const googleUserEmail = this.getEmailFromOAuth2UserProfile(oauth2UserProfile);

        await this.integrationsValidator.validateMaxAddLimit(
            this.integrationsServiceLocator,
            user.id
        );

        const hasOutboundCalendar = await this.integrationsValidator.hasOutboundCalendar(
            this.integrationsServiceLocator,
            user.id
        );
        const isFirstIntegration = !hasOutboundCalendar;

        await this.googleIntegrationService.create(
            profile,
            teamSetting,
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

    }

    getEmailFromOAuth2UserProfile(
        oauth2UserProfile: GoogleOAuth2UserWithToken
    ): string {
        return oauth2UserProfile.googleUser.email;
    }
}
