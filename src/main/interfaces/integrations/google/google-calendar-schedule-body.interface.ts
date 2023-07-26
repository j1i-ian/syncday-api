import { GoogleCalendarEvent } from '@app/interfaces/integrations/google/google-calendar-event.interface';

export interface GoogleCalendarScheduleBody {
    [calendarId: string]: GoogleCalendarEvent[];
}
