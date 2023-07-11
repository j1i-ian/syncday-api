import { RRule } from 'rrule';

import { Injectable } from '@nestjs/common';
import { calendar_v3 } from 'googleapis';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleCalendarScheduleBody } from '@app/interfaces/integrations/google/google-calendar-schedule-body.interface';

@Injectable()
export class GoogleConverterService {

    convertToGoogleCalendarIntegration(
        googleCalendars: calendar_v3.Schema$CalendarList
    ): GoogleCalendarIntegration[] {
        const { items } = googleCalendars;

        return (items as calendar_v3.Schema$CalendarListEntry[]).map(
            (item) =>
                ({
                    name: item.id,
                    description: item.summary,
                    googleCalendarAccessRole: item.accessRole,
                    color: item.foregroundColor,
                    primary: item.primary || false,
                    raw: item
                } as GoogleCalendarIntegration)
        );
    }

    convertToGoogleIntegrationSchedules(googleCalendarScheduleBody: GoogleCalendarScheduleBody): GoogleIntegrationSchedule[] {

        return Object.entries(googleCalendarScheduleBody)
            .flatMap(([_calendarId, _googleSchedules]) =>
                _googleSchedules.reduce((_allSchedules, _googleSchedule) => {


                    let convertedSchedules: GoogleIntegrationSchedule[] = [];

                    const { startDatetime, endDatetime } = this.convertGoogleScheduleToDateTimes(_googleSchedule);

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

                    return _allSchedules.concat(convertedSchedules);
                }, [] as GoogleIntegrationSchedule[])
            );
    }

    convertGoogleScheduleToDateTimes(
        _googleScheduleEvent: calendar_v3.Schema$Event
    ): { startDatetime: Date; endDatetime: Date } {

        const _googleScheduleStartDatetime = _googleScheduleEvent.start as calendar_v3.Schema$EventDateTime;
        const _googleScheduleEndDatetime = _googleScheduleEvent.end as calendar_v3.Schema$EventDateTime;
        const {
            date: RFC3339StartDateHeadString,
            dateTime: RFC3339StartDateTimeString
        } = _googleScheduleStartDatetime;
        const ensuredRFC3339StartDateString =
            RFC3339StartDateHeadString ?
                `${RFC3339StartDateHeadString }T00:00:00` :
                RFC3339StartDateTimeString;
        const startDatetime = new Date(ensuredRFC3339StartDateString as string);

        const {
            date: RFC3339EndDateHeadString,
            dateTime: RFC3339EndDateTimeString
        } = _googleScheduleEndDatetime;
        const ensuredRFC3339EndDateTimeString = RFC3339EndDateHeadString ?
            `${RFC3339EndDateHeadString }T00:00:00` :
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
    ): GoogleIntegrationSchedule[] {
        const recurrenceRulesString = (googleSchedule.recurrence as string[])[0];

        const diffTimestamp = endDate.getTime() - startDate.getTime();

        // TODO: apply dateRange.until
        const minDate = new Date(Math.max(startDate.getTime(), Date.now()));
        minDate.setMonth(startDate.getMonth(), startDate.getDate());
        minDate.setHours(0, 0, 0);

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

    _convertGoogleScheduleToGoogleIntegrationSchedule(
        calendarId: string,
        googleSchedule: calendar_v3.Schema$Event,
        startDatetime: Date,
        endDatetime: Date
    ): GoogleIntegrationSchedule {
        const defaultName = 'No Title: ' + calendarId;
        const ensuredName = googleSchedule.summary || defaultName;

        const newSchedule: GoogleIntegrationSchedule = {
            name: ensuredName,
            iCalUID: googleSchedule.iCalUID,
            scheduledTime: {
                startTimestamp: startDatetime,
                endTimestamp: endDatetime
            },
            originatedCalendarId: calendarId,
            raw: googleSchedule
        } as GoogleIntegrationSchedule;

        return newSchedule;
    }
}
