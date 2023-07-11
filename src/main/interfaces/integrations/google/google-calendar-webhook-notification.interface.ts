import { calendar_v3 } from 'googleapis';

export interface GoogleCalendarWebhookNotification {
    // will be patched from x-goog-channel-expiration header
    xGoogChannelExpiration: string;
    // will be patched from x-goog-channel-expiration header
    xGoogChannelId: string;

    // will be patched from x-goog-resource-id header
    xGoogResourceId: string;
    // will be patched from x-goog-resource-uri header
    xGoogResourceUri: string;

    raw: calendar_v3.Schema$Channel;
}
