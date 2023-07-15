import { calendar_v3, oauth2_v2 } from 'googleapis';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';
import { GoogleCalendarScheduleBody } from '@app/interfaces/integrations/google/google-calendar-schedule-body.interface';

export interface GoogleOAuth2UserWithToken {
    googleUser: oauth2_v2.Schema$Userinfo & {
        email: string;
        name: string;
        picture: string;
    };
    calendars: calendar_v3.Schema$CalendarList & {
        items: calendar_v3.Schema$CalendarListEntry[];
    };
    schedules: GoogleCalendarScheduleBody;

    tokens: OAuthToken;
}
