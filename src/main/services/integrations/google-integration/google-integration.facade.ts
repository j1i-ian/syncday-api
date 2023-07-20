import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3 } from 'googleapis';
import { AppConfigService } from '@config/app-config.service';
import { GoogleOAuthClientService } from '@services/integrations/google-integration/facades/google-oauth-client.service';
import { GoogleOAuthTokenService } from '@services/integrations/google-integration/facades/google-oauth-token.service';
import { GoogleOAuthUserService } from '@services/integrations/google-integration/facades/google-oauth-user.service';
import { GoogleCalendarListService } from '@services/integrations/google-integration/facades/google-calendar-list.service';
import { GoogleCalendarEventListService } from '@services/integrations/google-integration/facades/google-calendar-event-list.service';
import { GoogleOAuth2UserWithToken } from '@app/interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { GoogleCalendarScheduleBody } from '@app/interfaces/integrations/google/google-calendar-schedule-body.interface';
import { GoogleIntegrationBody } from '@app/interfaces/integrations/google/google-integration-body.interface';

@Injectable()
export class GoogleIntegrationFacade {
    constructor(private readonly configService: ConfigService) {
        const { redirectURI: signInOrUpRedirectURI } = AppConfigService.getGoogleOAuth2Setting(
            this.configService
        );
        this.signInOrUpRedirectURI = signInOrUpRedirectURI;
    }

    signInOrUpRedirectURI: string;

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

        const tokens = await googleOAuthTokenService.issueGoogleTokenByAuthorizationCode(
            oauthClient,
            authorizationCode
        );

        oauthClient.setCredentials({
            refresh_token: tokens.refreshToken
        });
        const googleUserInfo = await googleOAuthUserService.getGoogleUserInfo(oauthClient);

        const calendars = await googleCalendarListService.search(oauthClient);

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

                    return {
                        [_calendarId]: _loadedRawSchedules.items
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
            schedules
        };
    }

    generateGoogleOAuthAuthoizationUrl(): string {
        const redirectURI = this.signInOrUpRedirectURI;

        const googleOAuthClientService = new GoogleOAuthClientService();

        const credentials = AppConfigService.getGoogleCredentials(this.configService);

        const oauthClient = googleOAuthClientService.generateGoogleOAuthClient(
            credentials,
            redirectURI
        );

        const authorizationUrl = oauthClient.generateAuthUrl({
            access_type: 'offline',
            prompt: 'select_account consent',
            scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
            include_granted_scopes: true
        });

        return authorizationUrl;
    }
}
