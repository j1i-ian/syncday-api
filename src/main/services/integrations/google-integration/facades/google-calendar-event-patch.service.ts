import { Injectable } from '@nestjs/common';
import { Auth, calendar_v3, google } from 'googleapis';

@Injectable()
export class GoogleCalendarEventPatchService {

    async patch(
        oauthClient: Auth.OAuth2Client,
        calendarId: string,
        googleCalendarEventId: string,
        patchGoogleCalendarEventBody: calendar_v3.Schema$Event
    ): Promise<calendar_v3.Schema$Event> {
        const googleCalendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });

        const { data: patchedGoogleCalendarLink } = await googleCalendar.events.patch({
            calendarId,
            eventId: googleCalendarEventId,
            requestBody: patchGoogleCalendarEventBody
        });

        return patchedGoogleCalendarLink;
    }
}
