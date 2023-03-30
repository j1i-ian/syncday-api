import { MicrosoftCalendar } from './interface/microsoft-calendar.interface';

/**
 * [Docs]{@link https://learn.microsoft.com/en-us/graph/api/user-list-calendars?view=graph-rest-1.0&tabs=javascript}
 */
export interface MicrosoftCalendarsResopnseDTO {
    '@odata.context': string;
    value: MicrosoftCalendar[];
}
