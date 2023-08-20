import { calendar_v3 } from 'googleapis';
import { GoogleCalendarScheduleBody } from '@app/interfaces/integrations/google/google-calendar-schedule-body.interface';

export interface GoogleIntegrationBody {
    googleUserEmail: string;
    calendars: calendar_v3.Schema$CalendarList;
    schedules: GoogleCalendarScheduleBody;
}
