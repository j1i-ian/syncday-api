/**
 * The Access Role of Google Calendar.
 *
 * This field describes how much permissions the user has to access the calendar.
 *
 * @see {@link [Google Calendar list](https://developers.google.com/calendar/api/v3/reference/calendarList) }
 */
export enum GoogleCalendarAccessRole {
    OWNER = 'owner',
    WRITER = 'writer',
    READER = 'reader',
    FREE_BUSY_READER = 'freeBusyReader'
}
