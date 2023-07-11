import { Injectable, Scope } from '@nestjs/common';
import { Auth, google } from 'googleapis';

@Injectable({
    scope: Scope.REQUEST
})
export class GoogleCalendarEventWatchStopService {

    async stopWatch(oauthClient: Auth.OAuth2Client, notificationId: string, notificationResourceId: string): Promise<boolean> {

        const googleCalendar = google.calendar({
            version: 'v3',
            auth: oauthClient
        });

        const stopResult = await googleCalendar.channels.stop({
            requestBody: {
                id: notificationId,
                resourceId: notificationResourceId
            }
        });

        return stopResult.status === 204;
    }
}
