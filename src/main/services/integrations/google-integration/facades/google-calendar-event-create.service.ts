import { Injectable, Scope } from '@nestjs/common';
import { Auth, calendar_v3, google } from 'googleapis';

@Injectable({
    scope: Scope.REQUEST
})
export class GoogleCalendarEventCreateService {
    async create(
        oauthClient: Auth.OAuth2Client,
        calendarId: string,
        newGoogleCalendarEventBody: calendar_v3.Schema$Event
    ): Promise<calendar_v3.Schema$Events> {
        const googleCalendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });

        const { data: createdGoogleCalendarLink } = await googleCalendar.events.insert({
            calendarId,
            requestBody: newGoogleCalendarEventBody
        });

        return createdGoogleCalendarLink;
    }
}
