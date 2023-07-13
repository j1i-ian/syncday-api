import { Injectable, Scope } from '@nestjs/common';
import { Auth, calendar_v3, google } from 'googleapis';

@Injectable({
    scope: Scope.REQUEST
})
export class GoogleCalendarEventWatchService {

    async watch(
        oauthClient: Auth.OAuth2Client,
        calendarId: string,
        notificationId: string,
        notificationCallbackURL: string
    ): Promise<calendar_v3.Schema$Channel> {
        const googleCalendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });

        const watchResult = await googleCalendar.events.watch({
            showHiddenInvitations: true,
            timeMin: new Date().toISOString(),
            requestBody: {
                id: notificationId,
                type: 'webhook',
                address: notificationCallbackURL,
                payload: true
            },
            calendarId
        });

        return watchResult.data;
    }
}
