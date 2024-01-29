import { RRule } from 'rrule';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { calendar_v3 } from 'googleapis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { TimezoneOffset } from '@core/interfaces/integrations/timezone-offset.interface';
import { GoogleCalendarScheduleBody } from '@core/interfaces/integrations/google/google-calendar-schedule-body.interface';
import { GoogleCalendarEvent } from '@core/interfaces/integrations/google/google-calendar-event.interface';
import { GoogleOAuth2UserWithToken } from '@core/interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { Notification } from '@interfaces/notifications/notification';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { ScheduledReminder } from '@interfaces/scheduled-events/scheduled-reminder';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { UtilService } from '@services/util/util.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { OAuth2Converter } from '@services/integrations/oauth2-converter.interface';
import { CreateUserWithOAuth2DTO } from '@services/users/interfaces/create-user-with-oauth2-dto.interface';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { GoogleIntegrationScheduledEvent } from '@entity/integrations/google/google-integration-scheduled-event.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';

@Injectable()
export class GoogleConverterService implements OAuth2Converter {

    constructor(
        private readonly utilService: UtilService,
        private readonly timeUtilService: TimeUtilService
    ) {}

    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

    convertToCreateUserRequestDTO(
        timezone: string,
        oauth2UserProfile: GoogleOAuth2UserWithToken
    ): CreateUserWithOAuth2DTO {

        const { googleUser, calendars, tokens, schedules } = oauth2UserProfile;

        const newGoogleCalendarIntegrations = this.convertToGoogleCalendarIntegration(calendars);
        const googleUserEmail = googleUser.email;

        const primaryGoogleCalendar = calendars?.items.find((_cal) => _cal.primary) as calendar_v3.Schema$CalendarListEntry;
        const ensuredTimezone = timezone || primaryGoogleCalendar?.timeZone as string;

        const createUserRequestDto: CreateUserRequestDto = {
            email: googleUser.email,
            name: googleUser.name,
            timezone: ensuredTimezone
        };

        return {
            oauth2Type: OAuth2Type.GOOGLE,
            createUserRequestDto,
            oauth2Token: tokens,
            oauth2UserProfile: {
                oauth2UserEmail: googleUserEmail,
                oauth2UserProfileImageUrl: googleUser.picture
            },
            integrationParams: {
                googleCalendarIntegrations: newGoogleCalendarIntegrations,
                googleIntegrationBody: {

                    googleUserEmail,
                    calendars,
                    schedules
                },
                options: {
                    isFirstIntegration: true
                }
            }
        };
    }

    convertToGoogleCalendarIntegration(
        googleCalendars: calendar_v3.Schema$CalendarList,
        {
            filterGoogleGroupCalendars
        } = {
            filterGoogleGroupCalendars: true
        }
    ): GoogleCalendarIntegration[] {
        const { items } = googleCalendars;

        return (items as calendar_v3.Schema$CalendarListEntry[])
            .filter((_calendar) =>
                filterGoogleGroupCalendars === true ?
                    _calendar &&
                    _calendar.id &&
                    _calendar.id.includes('group.v.calendar.google.com') === false :
                    _calendar
            )
            .map(
                (item) =>
                    ({
                        name: item.id,
                        description: item.summary,
                        googleCalendarAccessRole: item.accessRole,
                        color: item.backgroundColor || '#2962ff',
                        primary: item.primary || false,
                        timezone: item.timeZone,
                        raw: item
                    } as GoogleCalendarIntegration)
            );
    }

    convertToGoogleIntegrationSchedules(googleCalendarScheduleBody: GoogleCalendarScheduleBody): GoogleIntegrationScheduledEvent[] {

        return Object.entries(googleCalendarScheduleBody)
            .flatMap(([_calendarId, _googleSchedules]) =>
                _googleSchedules
                    .filter((_googleSchedule) => _googleSchedule.recurrence || (_googleSchedule.start && _googleSchedule.end))
                    .reduce((_allSchedules, _googleSchedule) => {


                        let convertedSchedules: GoogleIntegrationScheduledEvent[] = [];

                        const { startDatetime, endDatetime } = this.convertGoogleScheduleToDateTimes(_googleSchedule);

                        try {

                            if (_googleSchedule.recurrence && _googleSchedule.recurrence.length > 0) {
                                convertedSchedules = this.convertRRuleGoogleEventToGoogleIntegrationSchedules(
                                    _calendarId,
                                    _googleSchedule,
                                    startDatetime,
                                    endDatetime
                                );

                            } else {

                                const convertedSchedule = this._convertGoogleScheduleToGoogleIntegrationSchedule(
                                    _calendarId,
                                    _googleSchedule,
                                    startDatetime,
                                    endDatetime
                                );
                                convertedSchedules.push(convertedSchedule);
                            }
                        } catch (error) {
                            this.logger.error({
                                message: 'Invalid Google Schedule is detetced',
                                error
                            });
                        }

                        return _allSchedules.concat(convertedSchedules);
                    }, [] as GoogleIntegrationScheduledEvent[])
            );
    }

    convertGoogleScheduleToDateTimes(
        _googleScheduleEvent: GoogleCalendarEvent
    ): { startDatetime: Date; endDatetime: Date } {

        const _timezoneOffset = this.getTimezoneOffset(_googleScheduleEvent.timezone);
        const minGMTString = _timezoneOffset.minuteOffset ? `:${ _timezoneOffset.minuteOffset }` : '';
        const gmtString = `GMT${ _timezoneOffset.sign ? '+' : '-' }${ _timezoneOffset.hourOffset }${ minGMTString }`;

        const _googleScheduleStartDatetime = _googleScheduleEvent.start as calendar_v3.Schema$EventDateTime;
        const _googleScheduleEndDatetime = _googleScheduleEvent.end as calendar_v3.Schema$EventDateTime;
        const {
            date: RFC3339StartDateHeadString,
            dateTime: RFC3339StartDateTimeString
        } = _googleScheduleStartDatetime;
        const ensuredRFC3339StartDateString =
            RFC3339StartDateHeadString ?
                `${ RFC3339StartDateHeadString } 00:00:00 ${gmtString}` :
                RFC3339StartDateTimeString;
        const startDatetime = new Date(ensuredRFC3339StartDateString as string);

        const {
            date: RFC3339EndDateHeadString,
            dateTime: RFC3339EndDateTimeString
        } = _googleScheduleEndDatetime;
        const ensuredRFC3339EndDateTimeString = RFC3339EndDateHeadString ?
            `${ RFC3339EndDateHeadString } 00:00:00 ${gmtString}` :
            RFC3339EndDateTimeString;
        const endDatetime = new Date(ensuredRFC3339EndDateTimeString as string);

        return {
            startDatetime,
            endDatetime
        };
    }

    convertRRuleGoogleEventToGoogleIntegrationSchedules(
        calendarId: string,
        googleSchedule: calendar_v3.Schema$Event,
        startDate: Date,
        endDate: Date
    ): GoogleIntegrationScheduledEvent[] {
        const recurrenceRulesString = (googleSchedule.recurrence as string[])[0];

        const diffTimestamp = endDate.getTime() - startDate.getTime();

        // TODO: apply dateRange.until
        const minDate = new Date(Math.max(startDate.getTime(), Date.now()));
        minDate.setMonth(startDate.getMonth(), startDate.getDate());
        minDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());

        const maxDate = new Date(Date.now () + new Date(0).setMonth(3));

        const generatedSchedulesByRRule = this.convertRecurrenceRuleToDates(
            recurrenceRulesString,
            minDate,
            maxDate,
            diffTimestamp
        );

        const convertedSchedules = generatedSchedulesByRRule.map(
            (_generatedSchedule) => this._convertGoogleScheduleToGoogleIntegrationSchedule(
                calendarId,
                googleSchedule,
                _generatedSchedule.startDatetime,
                _generatedSchedule.endDatetime
            )
        );

        return convertedSchedules;

    }

    convertRecurrenceRuleToDates(
        recurrenceRulesString: string,
        eventStartTime: Date,
        untilDate: Date,
        eventDurationTimestamp = 0
    ): Array<{ startDatetime: Date; endDatetime: Date }> {

        const parsedOptions = RRule.parseString(recurrenceRulesString);

        parsedOptions.dtstart = eventStartTime;
        parsedOptions.until = untilDate;

        const rrule = new RRule(parsedOptions);

        const dates = rrule.between(eventStartTime, untilDate, true);

        const convertedDates = dates.map((date) => {
            // Correct generated date
            const startDatetime = new Date(date);
            const endDatetime = new Date(startDatetime.getTime() + eventDurationTimestamp);
            return { startDatetime, endDatetime };
        });

        return convertedDates;
    }

    convertScheduledEventToGoogleCalendarEvent(
        hostTimezone: string,
        organizerEmail: string,
        scheduledEvent: ScheduledEvent
    ): calendar_v3.Schema$Event {
        const { startTimestamp, endTimestamp } = scheduledEvent.scheduledTime;

        const inviteeEmailAnswer = (scheduledEvent.scheduledNotificationInfo.invitee as Notification[]).find((_item) => _item.type === NotificationType.EMAIL) as Notification;
        const inviteeEmail = (inviteeEmailAnswer.reminders[0] as ScheduledReminder).typeValue;

        const summary = scheduledEvent.summary;
        const selectedContact = scheduledEvent.contacts[0];
        const generatedUUID = this.utilService.generateUUID();
        const eventRequestBody: calendar_v3.Schema$Event = {
            summary,
            description: scheduledEvent.description,
            attendees: [
                {
                    email: organizerEmail,
                    responseStatus: 'accepted'
                },
                {
                    email: inviteeEmail
                }
            ],
            start: {
                dateTime: new Date(startTimestamp).toISOString(),
                timeZone: hostTimezone
            },
            end: {
                dateTime: new Date(endTimestamp).toISOString(),
                timeZone: hostTimezone
            }
        };

        // when contact is no location, selectedContact can be undefined
        if (
            selectedContact &&
            (selectedContact.type === ContactType.GOOGLE_MEET)
        ) {
            eventRequestBody.conferenceData = {
                createRequest: {
                    requestId: generatedUUID,
                    conferenceSolutionKey: {
                        type: 'hangoutsMeet'
                    }
                }
            };
        } else {
            eventRequestBody.location = scheduledEvent.location.join('\n');
        }

        return eventRequestBody;
    }

    getTimezoneOffset(timezone: string): TimezoneOffset {
        return this.timeUtilService.getTimezoneOffset(timezone);
    }

    _convertGoogleScheduleToGoogleIntegrationSchedule(
        calendarId: string,
        googleSchedule: calendar_v3.Schema$Event,
        startDatetime: Date,
        endDatetime: Date
    ): GoogleIntegrationScheduledEvent {
        const defaultName = 'No Title: ' + calendarId;
        const ensuredName = googleSchedule.summary || defaultName;

        const newSchedule: GoogleIntegrationScheduledEvent = {
            name: ensuredName,
            iCalUID: googleSchedule.iCalUID,
            scheduledTime: {
                startTimestamp: startDatetime,
                endTimestamp: endDatetime
            },
            originatedCalendarId: calendarId,
            raw: googleSchedule
        } as GoogleIntegrationScheduledEvent;

        return newSchedule;
    }
}
