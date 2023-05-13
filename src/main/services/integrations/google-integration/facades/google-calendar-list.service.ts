import { Injectable } from '@nestjs/common';
import { Auth, calendar_v3, google } from 'googleapis';

@Injectable()
export class GoogleCalendarListService {
    async search(oauthClient: Auth.OAuth2Client): Promise<calendar_v3.Schema$CalendarList> {
        const googleCalendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });

        const { data: googleCalendarList } = await googleCalendar.calendarList.list();
        return googleCalendarList;
    }
}
