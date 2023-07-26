import { calendar_v3 } from 'googleapis';

export interface GoogleCalendarEvent extends calendar_v3.Schema$Event {
    timezone: string;
}
