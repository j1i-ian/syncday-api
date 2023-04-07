/**
 * 구글 캘린더의 4가지 액세스 역할
 * 참조: https://developers.google.com/calendar/api/v3/reference/calendarList?hl=ko
 */
export enum GoogleCalendarAccessRole {
    OWNER = 'owner',
    WRITER = 'writer',
    READER = 'reader',
    FREE_BUSY_READER = 'freeBusyReader'
}
