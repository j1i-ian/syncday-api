import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth, oauth2_v2, calendar_v3 } from 'googleapis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationCalendarSetting } from '@entity/integrations/google/Integration-calendar-setting.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarAccessRole } from '../../../enums/integrations/google-calendar-access-role.enum';

interface EnsuredGoogleTokenResponse {
    accessToken: string;
    refreshToken: string;
}

type EnsuredGoogleOAuth2User = oauth2_v2.Schema$Userinfo &
    EnsuredGoogleTokenResponse & {
        email: string;
    } & Partial<{
        name: string;
        picture: string;
    }>;

@Injectable()
export class IntegrationUtilService {
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly configService: ConfigService
    ) {
        this.googleOAauth2ClientMap = new Map<string, Auth.OAuth2Client>();
    }

    GOOGLE_CALENDAR_OAUTH_CLIENT_KEY = 'google_calendar_oauth_client_key';

    // <RedirectURI, Auth.OAuth2Client>
    private googleOAauth2ClientMap: Map<string, Auth.OAuth2Client>;

    async issueGoogleTokenByAuthorizationCode(
        oauthClient: Auth.OAuth2Client,
        authorizationCode: string
    ): Promise<{
        accessToken: string;
        refreshToken: string;
    }> {
        try {
            const { tokens } = await oauthClient.getToken(authorizationCode);
            const { access_token: accessToken, refresh_token: refreshToken } = tokens;

            if (!accessToken || !refreshToken) {
                throw new BadRequestException(
                    'Failed to fetch access token, refresh token with Google'
                );
            }

            return { accessToken, refreshToken };
        } catch (error) {
            throw new BadRequestException('Failed to link with Google');
        }
    }

    async getGoogleUserInfo(
        authorizationCode: string,
        redirectUri: string
    ): Promise<EnsuredGoogleOAuth2User> {
        try {
            const oauthClient = this.getGoogleOauthClient(redirectUri);

            const { accessToken, refreshToken } = await this.issueGoogleTokenByAuthorizationCode(
                oauthClient,
                authorizationCode
            );

            oauthClient.setCredentials({
                refresh_token: refreshToken
            });

            const oauth2 = google.oauth2({
                version: 'v2',
                auth: oauthClient
            });

            const { data } = await oauth2.userinfo.get({
                auth: oauthClient
            });

            return {
                ...data,
                accessToken,
                refreshToken
            } as EnsuredGoogleOAuth2User;
        } catch (error) {
            this.logger.error(error);
            throw new BadRequestException('Failed to retrieve user information from Google');
        }
    }

    /**
     * @returns 해당 유저의 기본 캘린더
     */
    async getGooglePrimaryCalendar(
        refreshToken: string,
        oauthClient: Auth.OAuth2Client
    ): Promise<calendar_v3.Schema$Calendar> {
        oauthClient.setCredentials({
            refresh_token: refreshToken
        });

        const calendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });
        const { data } = await calendar.calendars.get({
            calendarId: 'primary'
        });
        return data;
    }

    async getGoogleCalendarList(
        calendarSetting: IntegrationCalendarSetting,
        googleIntegration: GoogleIntegration
    ): Promise<calendar_v3.Schema$CalendarList> {
        const googleCalendarOauthClient = this.getGoogleCalendarOauthClient(googleIntegration);

        let minAccessRole: GoogleCalendarAccessRole;

        if (calendarSetting.deleteSynchronize || calendarSetting.writeSynchronize) {
            minAccessRole = GoogleCalendarAccessRole.WRITER;
        } else {
            minAccessRole = GoogleCalendarAccessRole.FREE_BUSY_READER;
        }

        const { data } = await googleCalendarOauthClient.calendarList.list({
            minAccessRole
        });

        return data;
    }

    getGoogleCalendarOauthClient(googleIntegration: GoogleIntegration): calendar_v3.Calendar {
        const clientKey = this.GOOGLE_CALENDAR_OAUTH_CLIENT_KEY;
        const oauthClient = this.getGoogleOauthClient(clientKey);
        oauthClient.setCredentials({
            refresh_token: googleIntegration.refreshToken
        });

        const googleCalendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });

        return googleCalendar;
    }

    getGoogleOauthClient(clientKey: string): Auth.OAuth2Client {
        const oauthClient = this.googleOAauth2ClientMap.get(clientKey);

        let ensuredOAuthClient: Auth.OAuth2Client;

        if (!oauthClient) {
            const newOAuthClient = new google.auth.OAuth2({
                ...AppConfigService.getGoogleCredentials(this.configService),
                redirectUri: clientKey
            });
            this.googleOAauth2ClientMap.set(clientKey, newOAuthClient);
            ensuredOAuthClient = newOAuthClient;
        } else {
            ensuredOAuthClient = oauthClient;
        }

        return ensuredOAuthClient;
    }
}
