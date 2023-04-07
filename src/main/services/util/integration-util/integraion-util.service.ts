import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth, oauth2_v2, calendar_v3 } from 'googleapis';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationCalendarSetting } from '@entity/integrations/google/Integration-calendar-setting.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarAccessRole } from '../../../enums/integrations/google-calendar-access-role.enum';
@Injectable()
export class IntegrationUtilService {
    constructor(private readonly configService: ConfigService) {}

    async getGoogleUserInfo(
        refreshToken: string,
        oauthClient: Auth.OAuth2Client
    ): Promise<oauth2_v2.Schema$Userinfo> {
        oauthClient.setCredentials({
            refresh_token: refreshToken
        });

        const oauth2 = google.oauth2({
            version: 'v2',
            auth: oauthClient
        });

        const { data } = await oauth2.userinfo.get();
        return data;
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

    getGoogleOauthClient(redirectUri?: string): Auth.OAuth2Client {
        const oauth2Client = new google.auth.OAuth2({
            ...AppConfigService.getGoogleCredentials(this.configService),
            redirectUri
        });

        return oauth2Client;
    }

    getGoogleCalendarOauthClient(googleIntegration: GoogleIntegration): calendar_v3.Calendar {
        const oauthClient = this.getGoogleOauthClient();
        oauthClient.setCredentials({
            refresh_token: googleIntegration.refreshToken
        });

        const googleCalendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });

        return googleCalendar;
    }
}
