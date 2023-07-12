import { Injectable, Scope } from '@nestjs/common';
import { Auth, calendar_v3, google } from 'googleapis';

@Injectable({
    scope: Scope.REQUEST
})
export class GoogleCalendarEventListService {
    async search(oauthClient: Auth.OAuth2Client, calendarId: string): Promise<calendar_v3.Schema$Events> {
        const googleCalendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });

        const { data: events } = await googleCalendar.events.list({
            calendarId,
            maxResults: 1000,
            timeMin: new Date().toISOString()
        });

        return events;
    }
}
