import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth, calendar_v3, oauth2_v2 } from 'googleapis';
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

type EnsuredGoogleCalendarChannel = {
    expiration: string;
    resourceId: string;
} & calendar_v3.Schema$Channel;

enum GoogleIntegrationClientKey {
    GOOGLE_CALENDAR_OAUTH_CLIENT_KEY = 'google_calendar_oauth_client_key'
}

@Injectable()
export class IntegrationUtilService {
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly configService: ConfigService
    ) {}

    generateGoogleOAuthAuthoizationUrl(): string {
        const redirectURI = this.configService.get<string>('GOOGLE_REDIRECT_URI') as string;

        const oauthClient = this.generateGoogleOauthClient(redirectURI);

        const authorizationUrl = oauthClient.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
            include_granted_scopes: true
        });

        return authorizationUrl;
    }

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
        oauthClient: Auth.OAuth2Client,
        refreshToken: string
    ): Promise<EnsuredGoogleOAuth2User> {
        try {
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

    /**
     * 만료기간 1달인 채널을 생성한다.
     * 캘린더의 이벤트가 변경될 때마다 "address" 에 지정한 웹훅을 호출한다.
     * ref:  https://developers.google.com/calendar/api/guides/push?hl=ko
     */
    async subscribeGoogleCalendarModifingEvents(
        googleIntegration: GoogleIntegration,
        googleCalendarId: string,
        channelId: string
    ): Promise<EnsuredGoogleCalendarChannel> {
        const googleCalendarOauthClient = this.getGoogleCalendarOauthClient(googleIntegration);

        const expireOneMonthLaterTimestamp = new Date().setMonth(new Date().getMonth() + 1);
        const expireOneMonthLater = new Date(expireOneMonthLaterTimestamp);

        const webhookUrl = AppConfigService.getGoogleCalendarWebhookUrl(this.configService);

        const { data } = (await googleCalendarOauthClient.events.watch({
            calendarId: googleCalendarId,
            requestBody: {
                id: channelId,
                expiration: expireOneMonthLater.getTime().toString(),
                type: 'webhook',
                address: webhookUrl
            }
        })) as { data: EnsuredGoogleCalendarChannel };

        return data;
    }

    async unsubscribeGoogleCalendarModifingEvents(
        googleIntegration: GoogleIntegration,
        googleChannelId: string | null,
        googleResourceId: string | null
    ): Promise<void> {
        if (!googleChannelId || !googleResourceId) {
            throw new BadRequestException('Invalid subscription');
        }

        const googleCalendarOauthClient = this.getGoogleCalendarOauthClient(googleIntegration);

        await googleCalendarOauthClient.channels.stop({
            requestBody: {
                id: googleChannelId,
                resourceId: googleResourceId
            }
        });
    }

    getGoogleCalendarOauthClient(googleIntegration: GoogleIntegration): calendar_v3.Calendar {
        const clientKey = GoogleIntegrationClientKey.GOOGLE_CALENDAR_OAUTH_CLIENT_KEY;
        const oauthClient = this.generateGoogleOauthClient(clientKey);
        oauthClient.setCredentials({
            refresh_token: googleIntegration.refreshToken
        });

        const googleCalendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });

        return googleCalendar;
    }

    generateGoogleOauthClient(
        redirectURI?: undefined | string | GoogleIntegrationClientKey
    ): Auth.OAuth2Client {
        const credentials = AppConfigService.getGoogleCredentials(this.configService);

        const newOAuthClient = new google.auth.OAuth2({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            redirectUri: redirectURI
        });

        return newOAuthClient;
    }
}
