import { BadRequestException, Injectable } from '@nestjs/common';
import { Attendee, DateArray, createEvent } from 'ics';
import { TimezoneOffset } from '@core/interfaces/integrations/timezone-offset.interface';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { Schedule } from '@entity/schedules/schedule.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { AvailableTime } from '@entity/availability/availability-time.entity';
import { TimeRange } from '@entity/events/time-range.entity';

type LocalizedDate = {
    [key in keyof Intl.DateTimeFormatOptions]: string;
};

@Injectable()
export class TimeUtilService {

    isPastTimestamp(startDateTimestamp: number, ensuredEndDateTimestamp: number): boolean {
        return startDateTimestamp < Date.now() ||
            ensuredEndDateTimestamp < Date.now();
    }

    findOverlappingDateOverride(
        timezone: string,
        overrides: OverridedAvailabilityTime[],
        requestedStartDateTimestamp: number,
        requestedEndDateTimestamp: number
    ): OverridedAvailabilityTime | undefined {

        const overlappingDateOverride = overrides.find((_override) => {

            const { targetDate: _targetDate } = _override;
            // check request time is in date override range
            const _dateStartTime = '00:00';
            const _dateEndTime = '23:59';

            const ensuredTargetDate = new Date(_targetDate);
            const _localizedDateStartTime = this.localizeDateTime(
                ensuredTargetDate,
                timezone,
                _dateStartTime,
                {
                    day: ensuredTargetDate.getUTCDate()
                }
            );
            const _localizedDateEndTime = this.localizeDateTime(
                ensuredTargetDate,
                timezone,
                _dateEndTime,
                {
                    day: ensuredTargetDate.getUTCDate()
                }
            );

            const isOverlapping = (_localizedDateStartTime.getTime() < requestedStartDateTimestamp && requestedStartDateTimestamp < _localizedDateEndTime.getTime()) ||
                (_localizedDateStartTime.getTime() < requestedEndDateTimestamp && requestedEndDateTimestamp < _localizedDateEndTime.getTime());

            return isOverlapping;
        });

        return overlappingDateOverride;
    }

    /**
     * This method returns true if given params are valid
     * nor returns false for invalid
     *
     * @param timezone
     * @param overrides
     * @param requestedStartDateTimestamp The schedule start time requested by the invitee
     * @param requestedEndDateTimestamp The schedule end time requested by the invitee
     * @returns true: valid / false: invalid
     */
    isTimeOverlappingWithAvailableTimeOverrides(
        timezone: string,
        overlappingOverride: OverridedAvailabilityTime,
        requestedStartDateTimestamp: number,
        requestedEndDateTimestamp: number
    ): boolean {

        const { targetDate: _targetDate } = overlappingOverride;

        let matchedTimeRange = false;

        if (overlappingOverride.timeRanges.length > 0) {

            const _foundOverlappingTimeRange = overlappingOverride.timeRanges.find((__timeRange) => {
                const {
                    startTime,
                    endTime
                } = __timeRange as {
                    startTime: string;
                    endTime: string;
                };
                const ensuredTargetDate = new Date(_targetDate);
                const _startDateTime = this.localizeDateTime(
                    ensuredTargetDate,
                    timezone,
                    startTime,
                    {
                        day: ensuredTargetDate.getUTCDate()
                    }
                );
                const _endDateTime = this.localizeDateTime(
                    ensuredTargetDate,
                    timezone,
                    endTime,
                    {
                        day: ensuredTargetDate.getUTCDate()
                    }
                );
                return _startDateTime.getTime() < requestedStartDateTimestamp &&
                    requestedEndDateTimestamp < _endDateTime.getTime();
            });

            matchedTimeRange = !!_foundOverlappingTimeRange;
        } else {
            const targetNextDateTimestamp = new Date().setDate(new Date(_targetDate).getDate() + 1);
            const targetDateTimestamp = _targetDate.getTime();

            matchedTimeRange =
            (targetDateTimestamp < requestedStartDateTimestamp && requestedStartDateTimestamp < targetNextDateTimestamp)
            || (targetDateTimestamp < requestedEndDateTimestamp && requestedEndDateTimestamp < targetNextDateTimestamp);
        }

        return matchedTimeRange;
    }

    isTimeOverlappingWithAvailableTimes(
        availableTimes: AvailableTime[],
        availabilityTimezone: string,
        startDateTime: Date,
        endDateTime: Date
    ): boolean {

        const startTimeString = this.dateToTimeString(startDateTime, availabilityTimezone);
        const endTimeString = this.dateToTimeString(endDateTime, availabilityTimezone);

        const localizedStartDateTime = this.localizeDateTime(
            startDateTime,
            availabilityTimezone,
            startTimeString
        );

        const localizedEndDateTime = this.localizeDateTime(
            endDateTime,
            availabilityTimezone,
            endTimeString
        );

        const localizedDate = Intl.DateTimeFormat([], {
            timeZone: availabilityTimezone,
            day: '2-digit'
        }).format(new Date(localizedStartDateTime));

        let startWeekday: number;
        let endWeekday: number;

        if (+localizedDate !== localizedStartDateTime.getDate()) {
            startWeekday = (localizedStartDateTime.getDay() + 1) % 7;
            endWeekday = (localizedEndDateTime.getDay() + 1) % 7;
        } else {
            startWeekday = localizedStartDateTime.getDay();
            endWeekday = localizedEndDateTime.getDay();
        }

        const startWeekdayAvailableTime = availableTimes.find((_availableTime) => _availableTime.day === startWeekday);
        const endWeekdayAvailableTime = availableTimes.find((_availableTime) => _availableTime.day === endWeekday);

        let isTimeOverlapping;

        if (startWeekdayAvailableTime && endWeekdayAvailableTime) {
            const isTimeOverlappingWithStartDateTime = this.isTimeOverlappingWithAvailableTimeRange(
                localizedStartDateTime,
                availabilityTimezone,
                startWeekdayAvailableTime.timeRanges
            );
            const isTimeOverlappingWithEndDateTime = this.isTimeOverlappingWithAvailableTimeRange(
                localizedStartDateTime,
                availabilityTimezone,
                endWeekdayAvailableTime.timeRanges
            );

            isTimeOverlapping = isTimeOverlappingWithStartDateTime && isTimeOverlappingWithEndDateTime;
        } else {
            isTimeOverlapping = false;
        }

        return isTimeOverlapping;
    }

    isTimeOverlappingWithAvailableTimeRange(dateTime: Date, timezone: string, timeRanges: TimeRange[]): boolean {

        const isTimeOverlappingDateTime = timeRanges.some((_timeRange) => {
            const {
                startTime: timeRangeStartTime,
                endTime: timeRangeEndTime
            } = _timeRange as { startTime: string; endTime: string };

            const localizedTimeRangeStartDateTime = this.localizeDateTime(
                dateTime,
                timezone,
                timeRangeStartTime
            );

            const localizedTimeRangeEndDateTime = this.localizeDateTime(
                dateTime,
                timezone,
                timeRangeEndTime
            );

            return localizedTimeRangeStartDateTime.getTime() <= dateTime.getTime() &&
                dateTime.getTime() <= localizedTimeRangeEndDateTime.getTime();
        });

        return isTimeOverlappingDateTime;
    }

    // TODO: Should be written test
    getTimezoneOffset(timezone: string): TimezoneOffset {

        const formatter = Intl.DateTimeFormat([], {
            timeZone: timezone,
            timeZoneName: 'short'
        });
        const formattedDate = formatter.format(new Date());

        const matchedGMTStringGroup = formattedDate
            .match(/.*(?<timezoneDiff>GMT[-+]\d(:\d\d)?).*/)?.groups;

        let timezoneOffset: TimezoneOffset;

        const timezoneDiff = matchedGMTStringGroup && matchedGMTStringGroup.timezoneDiff;
        const matchedTimezoneDiff = timezoneDiff?.match(/GMT(?<sign>[+-])(?<hourOffset>\d)(:(?<minuteOffset>\d\d))?/);

        if (matchedTimezoneDiff) {
            timezoneOffset = matchedTimezoneDiff.groups as unknown as TimezoneOffset;

            const _sign = (timezoneOffset.sign as unknown as string) === '+';
            timezoneOffset.sign = _sign;
        } else {

            const localizedDate = this.localizeDate(new Date(), timezone);
            const _today = new Date();
            const utcYYYYMMDD = [ _today.getUTCFullYear(), (_today.getUTCMonth() + 1).toString().padStart(2, '0'), _today.getUTCDate().toString().padStart(2, '0') ].join('');

            const localizedDateYYYYMMDD = [localizedDate.year, localizedDate.month, localizedDate.day].join('');

            let _sign;
            if (+localizedDateYYYYMMDD > +utcYYYYMMDD) {
                _sign = true;
            } else if (+localizedDateYYYYMMDD === +utcYYYYMMDD) {
                _sign = +(localizedDate.hour as string) > _today.getUTCHours();
            } else {
                _sign = false;
            }

            let _hourOffset;

            const utcHour = new Date().getUTCHours();
            if (+(localizedDate.hour as string) > utcHour) {
                _hourOffset = Math.abs(new Date().getUTCHours() - +(localizedDate.hour as string));
            } else {
                _hourOffset = 24 - Math.abs(new Date().getUTCHours() - +(localizedDate.hour as string));
            }

            if (_sign === false) {
                _hourOffset *= -1;
            }

            const _minuteOffset = (60 - (Math.abs(+(localizedDate.minute as string) - new Date().getUTCMinutes()))) % 60;

            // eslint-disable-next-line prefer-const
            timezoneOffset = {
                sign: _sign,
                hourOffset: _hourOffset,
                minuteOffset: _minuteOffset
            };
        }

        return timezoneOffset;
    }

    dateToTimeString(
        date: Date,
        timezone: string
    ): string {

        const formatPartObject = this.localizeDateTimeFormatPartObject(date, timezone);

        const localizedHour = String(formatPartObject.hour).padStart(2, '0');
        const localizedMins = String(formatPartObject.minute).padStart(2, '0');

        return `${localizedHour}:${localizedMins}`;
    }

    // TODO: Should be written test
    localizeDate(date: Date, timezone: string): LocalizedDate {

        const defaultOptions = this.localizingDefaultOption;
        defaultOptions.timeZone = timezone;

        const formatter = new Intl.DateTimeFormat('en-GB', defaultOptions);

        const parts = formatter.formatToParts(date);
        const localizedDate: LocalizedDate =
            Object.fromEntries(
                parts.map((_p) => [_p.type, _p.value])
            ) as unknown as LocalizedDate;
        localizedDate.timeZoneName = 'short';

        return localizedDate;
    }

    /**
     * @param timeString ex) 10:00
     */
    localizeDateTime(
        date: Date,
        timezone: string,
        timeString: string,
        overrideOptions: null | {
            day: number;
        } = null
    ): Date {

        const formatPartObject = this.localizeDateTimeFormatPartObject(date, timezone);

        const year = formatPartObject['year'] as string;
        const month = formatPartObject['month'] as string;
        const day = overrideOptions ? String(overrideOptions.day) : formatPartObject['day'] as string;
        const GMTShortString = formatPartObject['timeZoneName'] as string;

        const YYYYMMDD = `${year}-${month}-${day}`;
        const parsedDate = new Date(`${YYYYMMDD} ${timeString}:00 ${GMTShortString}`);

        return parsedDate;
    }

    localizeDateTimeFormatPartObject(
        date: Date,
        timezone: string
    ): LocalizedDate {

        const formatPartEntries = new Intl.DateTimeFormat('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: timezone,
            timeZoneName: 'short'
        }).formatToParts(date)
            .map((_formatPart) => [_formatPart.type, _formatPart.value]);

        const formatPartObject = Object.fromEntries(formatPartEntries);

        return formatPartObject;
    }

    /**
     * Calendar object resources contained in calendar collections MUST NOT specify
     * the iCalendar METHOD property.
     *
     * @see {@link [RFC4791](https://datatracker.ietf.org/doc/html/rfc4791#section-4.1) }
     */
    convertToICSString(
        uuid: string,
        organizerEmail: string,
        schedule: Schedule
    ): string {
        const {
            summary,
            scheduledTime: {
                startTimestamp,
                endTimestamp
            },
            description,
            location,
            host,
            inviteeAnswers,
            scheduledEventNotifications
        } = schedule;

        const startDate = new Date(startTimestamp);
        const endDate = new Date(endTimestamp);

        const inviteeName = inviteeAnswers[0].name;
        const attendees: Attendee[] = scheduledEventNotifications.filter(
            (_scheduledEventNotification) =>
                _scheduledEventNotification.notificationType === NotificationType.EMAIL
        ).map((_emailEventNotification) => ({
            email: _emailEventNotification.reminderValue,
            name: inviteeName,
            partstat: 'NEEDS-ACTION'
        } as Attendee));

        const startDateTimeArray = [
            startDate.getUTCFullYear(),
            startDate.getUTCMonth() + 1,
            startDate.getUTCDate(),
            startDate.getUTCHours(),
            startDate.getUTCMinutes()
        ] as DateArray;

        const duration = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);

        /** We generate the ICS files */
        const { error, value: iCalString } = createEvent({
            uid: uuid,
            startInputType: 'utc',
            start: startDateTimeArray,
            duration: {
                seconds: duration
            },
            title: summary,
            description,
            location: location.join('\n'),
            organizer: {
                email: organizerEmail,
                name: host.name
            },
            attendees
        });

        if (error || !iCalString) {
            throw new BadRequestException('Cannot create ICS String');
        }

        return iCalString.replace(/METHOD:[^\r\n]+\r\n/g, '');
    }

    getTimezoneGMTString(timezone: string): string | undefined {

        const formatOptions = {
            timeZone: timezone,
            timeZoneName: 'longOffset'
        } as Intl.DateTimeFormatOptions;

        const formatter = new Intl.DateTimeFormat('en-GB', formatOptions);
        const formattedDate = formatter.format(new Date());

        const gmtExtractExpression = /.*(?<timezoneDiff>GMT[-+]\d\d:\d\d).*/;
        const matchedGMTStringGroup = formattedDate
            .match(gmtExtractExpression)?.groups;

        return matchedGMTStringGroup?.timezoneDiff;
    }

    get localizingDefaultOption(): Intl.DateTimeFormatOptions {
        return {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        } as Intl.DateTimeFormatOptions;
    }
}
