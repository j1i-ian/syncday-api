import { calendar_v3 } from 'googleapis';

export interface GoogleCalendarScheduleBody {
    [calendarId: string]: calendar_v3.Schema$Event[];
}
