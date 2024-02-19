import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3 } from 'googleapis';
import { GoogleOAuth2UserWithToken } from '@core/interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { GoogleCalendarEvent } from '@core/interfaces/integrations/google/google-calendar-event.interface';
import { GoogleCalendarScheduleBody } from '@core/interfaces/integrations/google/google-calendar-schedule-body.interface';
import { GoogleIntegrationBody } from '@core/interfaces/integrations/google/google-integration-body.interface';
import { GoogleAxiosErrorResponse } from '@core/interfaces/integrations/google/google-axios-error-response.interface';
import { GoogleAxiosErrorReasons } from '@core/interfaces/integrations/google/google-axios-error-reasons.enum';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { SyncdayOAuth2StateParams } from '@core/interfaces/integrations/syncday-oauth2-state-params.interface';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { GoogleOAuthClientService } from '@services/integrations/google-integration/facades/google-oauth-client.service';
import { GoogleOAuthTokenService } from '@services/integrations/google-integration/facades/google-oauth-token.service';
import { GoogleOAuthUserService } from '@services/integrations/google-integration/facades/google-oauth-user.service';
import { GoogleCalendarListService } from '@services/integrations/google-integration/facades/google-calendar-list.service';
import { GoogleCalendarEventListService } from '@services/integrations/google-integration/facades/google-calendar-event-list.service';
import { IntegrationsFacade } from '@services/integrations/integrations.facade.interface';
import { ZoomUserResponseDTO } from '@app/interfaces/integrations/zoom/zoom-user-response.interface';

@Injectable()
export class GoogleIntegrationFacade implements IntegrationsFacade {
    constructor(private readonly configService: ConfigService) {
        const { redirectURI: signInOrUpRedirectURI } = AppConfigService.getOAuth2Setting(
            IntegrationVendor.GOOGLE,
            this.configService
        );
        this.signInOrUpRedirectURI = signInOrUpRedirectURI;
    }

    signInOrUpRedirectURI: string;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    issueToken(authorizationCode: string): Promise<OAuthToken> {
        throw new Error('Method not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    issueTokenByRefreshToken(refreshToken: string): Promise<OAuthToken> {
        throw new Error('Method not implemented.');
    }

    getOAuth2SuccessRedirectURI(): string {
        throw new Error('Method not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fetchOAuth2User(oauth2Token: OAuthToken): Promise<ZoomUserResponseDTO> {
        throw new Error('Method not implemented.');
    }

    async fetchGoogleUsersWithToken(authorizationCode: string, {
        onlyPrimaryCalendarSchedule
    } = {
        onlyPrimaryCalendarSchedule: false
    }): Promise<GoogleOAuth2UserWithToken> {
        const googleOAuthClientService = new GoogleOAuthClientService();
        const googleOAuthTokenService = new GoogleOAuthTokenService();
        const googleOAuthUserService = new GoogleOAuthUserService();
        const googleCalendarListService = new GoogleCalendarListService();
        const googleCalendarEventListService = new GoogleCalendarEventListService();

        const redirectURI = this.signInOrUpRedirectURI;

        const credentials = AppConfigService.getGoogleCredentials(this.configService);

        const oauthClient = googleOAuthClientService.generateGoogleOAuthClient(
            credentials,
            redirectURI
        );

        const tokens = await googleOAuthTokenService.issueOAuthTokenByAuthorizationCode(
            oauthClient,
            authorizationCode
        );

        oauthClient.setCredentials({
            refresh_token: tokens.refreshToken
        });
        const googleUserInfo = await googleOAuthUserService.getGoogleUserInfo(oauthClient);

        let insufficientPermission = false;
        let calendars: calendar_v3.Schema$CalendarList = { items: [] };

        try {
            calendars = await googleCalendarListService.search(oauthClient);
        } catch (error) {

            const insufficientPermissionError = (error as GoogleAxiosErrorResponse).errors.find((error) => error.reason === GoogleAxiosErrorReasons.INSUFFICIENT_PERMISSIONS);
            if (insufficientPermissionError) {
                insufficientPermission = true;
            } else {
                throw error;
            }
        }

        const googleScheduleRecordArray = await Promise.all(
            (calendars.items as calendar_v3.Schema$CalendarListEntry[])
                .filter((_calendar) =>
                    !!_calendar.id &&
                    _calendar.id.includes('group.v.calendar.google.com') === false
                )
                .filter((_calendar) => onlyPrimaryCalendarSchedule ? _calendar.primary : true)
                .map(async (_calendar) => {
                    const _calendarId = _calendar.id as string;
                    const _loadedRawSchedules = await googleCalendarEventListService.search(
                        oauthClient,
                        _calendarId
                    );

                    const ensuredRawSchedules = _loadedRawSchedules.items as GoogleCalendarEvent[] || [];
                    const patchedRawSchedules = ensuredRawSchedules.map(
                        (item: GoogleCalendarEvent) => {
                            item.timezone = _calendar.timeZone as string;
                            return item;
                        });

                    return {
                        [_calendarId]: patchedRawSchedules
                    } as GoogleCalendarScheduleBody;
                })
        );

        const schedules = googleScheduleRecordArray.reduce((_schedules, _schedule) => ({
            ..._schedules,
            ..._schedule
        }), {} as GoogleIntegrationBody['schedules']);

        return {
            googleUser: googleUserInfo as GoogleOAuth2UserWithToken['googleUser'],
            tokens,
            calendars: calendars as GoogleOAuth2UserWithToken['calendars'],
            schedules,
            insufficientPermission,
            integrationUserUniqueId: googleUserInfo.email as string
        };
    }

    generateGoogleOAuthAuthoizationUrl(
        integrationContext: IntegrationContext,
        decodedAppJwtPayloadOrNull: AppJwtPayload | null,
        timezone: string | null
    ): string {
        const redirectURI = this.signInOrUpRedirectURI;

        const googleOAuthClientService = new GoogleOAuthClientService();

        const credentials = AppConfigService.getGoogleCredentials(this.configService);

        const oauthClient = googleOAuthClientService.generateGoogleOAuthClient(
            credentials,
            redirectURI
        );

        const stateParams = {
            integrationContext,
            requestUserEmail: decodedAppJwtPayloadOrNull?.email,
            profileId: decodedAppJwtPayloadOrNull?.id,
            timezone
        } as SyncdayOAuth2StateParams;

        const jsonStringifiedStateParams = JSON.stringify(stateParams);

        /**
         * login_hint property is not working for callback api.
         * So data would serialized to state params.
         */
        const authorizationUrl = oauthClient.generateAuthUrl({
            access_type: 'offline',
            prompt: 'select_account consent',
            scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
            include_granted_scopes: true,
            state: jsonStringifiedStateParams
        });

        return authorizationUrl;
    }
}
