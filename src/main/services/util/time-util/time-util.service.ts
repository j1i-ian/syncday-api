import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Attendee, DateArray, createEvent } from 'ics';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { TimezoneOffset } from '@core/interfaces/integrations/timezone-offset.interface';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { TimeSlotCompare } from '@interfaces/scheduled-events/time-slot-compare.enum';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { AvailableTime } from '@entity/availability/availability-time.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { Weekday } from '@entity/availability/weekday.enum';
import { Availability } from '@entity/availability/availability.entity';

type LocalizedDate = {
    [key in keyof Intl.DateTimeFormatOptions]: string;
};

type TimeRangeArray = [TimeRange[], TimeRange[]];

@Injectable()
export class TimeUtilService {

    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

    intersectAvailability(
        availabilityA: Availability,
        availabilityB: Availability
    ): Availability {
        const {
            availableTimes: availableTimesA,
            overrides: overridedAvailableTimesA,
            timezone: timezoneA
        } = availabilityA;

        const {
            availableTimes: availableTimesB,
            overrides: overridedAvailableTimesB,
            timezone: timezoneB
        } = availabilityB;

        const intersectAvailableTimes = this.intersectAvailableTimes(
            availableTimesA,
            availableTimesB
        );

        this.logger.info({
            availableTimesA,
            overridedAvailableTimesA,
            timezoneA,
            availableTimesB,
            overridedAvailableTimesB,
            timezoneB
        });

        const intersectOverridedAvailableTimes = this.intersectOverridedAvailableTimes(
            overridedAvailableTimesA,
            overridedAvailableTimesB
        );

        this.logger.info({
            intersectOverridedAvailableTimes
        });

        const intersectAvailability = new Availability({
            availableTimes: intersectAvailableTimes,
            overrides: intersectOverridedAvailableTimes,
            timezone: timezoneA
        });

        intersectAvailability.overrides = this.intersectOverrideWithAvailableTimes(
            intersectAvailability.overrides,
            intersectAvailability.availableTimes
        );

        return intersectAvailability;
    }

    intersectOverrideWithAvailableTimes(
        overrides: OverridedAvailabilityTime[],
        availableTimes: AvailableTime[]
    ): OverridedAvailabilityTime[] {

        const intersectedOverrides = overrides
            .filter((_override) => {

                const overridateDate = new Date(_override.targetDate);

                const overrideDay = overridateDate.getDay();
                const isUnavailableTime = availableTimes.findIndex((_availableTime) => _availableTime.day === overrideDay) > -1;

                return isUnavailableTime;
            }).map((_override) => {

                if (_override.timeRanges.length === 0) {
                    return _override;
                }

                const overridateDate = new Date(_override.targetDate);

                const overrideDay = overridateDate.getDay();
                const { timeRanges: availableTimeRanges } = availableTimes.find((_availableTime) => _availableTime.day === overrideDay) as AvailableTime;

                _override.timeRanges = _override.timeRanges
                    .map((_overrideTimeRange) => {
                        availableTimeRanges.forEach((_availableTimeRange) => {

                            const maximizedStartTime = this.compareTimeSlot(
                                _overrideTimeRange.startTime,
                                _availableTimeRange.startTime,
                                TimeSlotCompare.MAX
                            );
                            _overrideTimeRange.startTime = maximizedStartTime;

                            const minimizedEndTime = this.compareTimeSlot(
                                _overrideTimeRange.endTime,
                                _availableTimeRange.endTime,
                                TimeSlotCompare.MIN
                            );
                            _overrideTimeRange.endTime = minimizedEndTime;
                        });

                        return _overrideTimeRange;
                    }).filter((_overrideTimeRange) => {
                        const { startTime, endTime } = _overrideTimeRange;

                        const isValidEndTime = this.compareTimeSlot(
                            startTime,
                            endTime,
                            TimeSlotCompare.MAX
                        );

                        return isValidEndTime === endTime;
                    });

                return _override;
            });

        return intersectedOverrides;

    }

    intersectOverridedAvailableTimes(
        overridedAvailableTimesA: OverridedAvailabilityTime[],
        overridedAvailableTimesB: OverridedAvailabilityTime[]
    ): OverridedAvailabilityTime[] {

        const intersectOverridedAvailableTimes: OverridedAvailabilityTime[] = [];

        // Map<ISODateString, [TimeRangeA[], TimeRangesB[]]>
        const intersectOverrideMap = new Map<string, Partial<TimeRangeArray>>();

        const allOverrides = overridedAvailableTimesA.concat(overridedAvailableTimesB);

        allOverrides.forEach(({
            targetDate: _targetDate,
            timeRanges
        }) => {

            const ensuredTargetDate = new Date(_targetDate);
            const _targetDateISOString = ensuredTargetDate.toISOString();

            let _timeRangesArray: Partial<TimeRangeArray> = [];

            if (intersectOverrideMap.has(_targetDateISOString)) {
                _timeRangesArray = intersectOverrideMap.get(_targetDateISOString) as Partial<TimeRangeArray>;
                _timeRangesArray.push(timeRanges);
            } else {
                _timeRangesArray = [timeRanges];
            }

            intersectOverrideMap.set(_targetDateISOString, _timeRangesArray);
        });

        const iterator = intersectOverrideMap.entries();

        let isIntersectionDone = false;

        do {

            const {
                value,
                done
            } = iterator.next();

            isIntersectionDone = done ?? true;

            if (done === true) {
                break;
            }

            const [ _targetDateISOString, _timeRangesArray ] = value;
            const _targetDate = new Date(_targetDateISOString);
            const [ _timeRangesA, _timeRangesB ] = _timeRangesArray as TimeRangeArray;

            const _isUniqueOverride = _timeRangesA === undefined || _timeRangesB === undefined;
            const _isUnavailableOverride = _timeRangesA
                && _timeRangesB
                && (_timeRangesA.length === 0 || _timeRangesB.length === 0);
            const _isIntersect = _timeRangesA
                && _timeRangesB
                && _timeRangesA.length > 0
                && _timeRangesB.length > 0;

            if (_isUniqueOverride) {
                const _ensturedTimeRange = _timeRangesA || _timeRangesB;

                intersectOverridedAvailableTimes.push({
                    targetDate: _targetDate,
                    timeRanges: _ensturedTimeRange
                });
            } else if (_isUnavailableOverride) {
                // Unavailable
                intersectOverridedAvailableTimes.push({
                    targetDate: _targetDate,
                    timeRanges: []
                });
            } else if (_isIntersect) {
                const __intersectTimeRanges = this.intersectTimeRanges(
                    _timeRangesA,
                    _timeRangesB
                );
                intersectOverridedAvailableTimes.push({
                    targetDate: _targetDate,
                    timeRanges: __intersectTimeRanges
                } as OverridedAvailabilityTime);
            } else {
                throw new BadRequestException('oh no');
            }
        } while (isIntersectionDone === false);

        // Sort Descending
        return intersectOverridedAvailableTimes
            .sort(({ targetDate: targetDateA }, { targetDate: targetDateB }) =>
                new Date(targetDateB).getTime() -
                new Date(targetDateA).getTime()
            );
    }

    intersectAvailableTimes(availableTimesA: AvailableTime[], availableTimesB: AvailableTime[]): AvailableTime[] {

        const intersectAvailableTimes: AvailableTime[] = [];

        const weekdays = Object.values(Weekday) as Weekday[];

        for (const weekday of weekdays) {
            const availableTimesAForWeekday = availableTimesA.find((availableTime) => availableTime.day === weekday);
            const availableTimesBForWeekday = availableTimesB.find((availableTime) => availableTime.day === weekday);

            if (availableTimesAForWeekday && availableTimesBForWeekday) {
                const intersectTimeRanges = this.intersectTimeRanges(
                    availableTimesAForWeekday.timeRanges,
                    availableTimesBForWeekday.timeRanges
                );

                intersectAvailableTimes.push({
                    day: weekday,
                    timeRanges: intersectTimeRanges
                });
            }
        }

        return intersectAvailableTimes;
    }

    intersectTimeRanges(timeRangesA: TimeRange[], timeRangesB: TimeRange[]): TimeRange[] {
        let pingA = 0;
        let pingB = 0;

        const intersectTimeRanges: TimeRange[] = [];

        while (true) {

            const timeRangeA = timeRangesA[pingA];
            const timeRangeB = timeRangesB[pingB];

            if (!timeRangeA || !timeRangeB) {
                break;
            } else {

                const maximizedStartTime = this.compareTimeSlot(timeRangeA.startTime, timeRangeB.startTime, TimeSlotCompare.MAX);
                const minimizedEndTime = this.compareTimeSlot(timeRangeA.endTime, timeRangeB.endTime, TimeSlotCompare.MIN);

                const isSameTime = maximizedStartTime !== minimizedEndTime;
                const linearedStartTimeOrNonLinearedEndTime = this.compareTimeSlot(maximizedStartTime, minimizedEndTime, TimeSlotCompare.MIN);

                const isLinearDeployment = linearedStartTimeOrNonLinearedEndTime === maximizedStartTime;

                if (isSameTime && isLinearDeployment) {

                    intersectTimeRanges.push({
                        startTime: maximizedStartTime,
                        endTime: minimizedEndTime
                    });
                }

                // update index
                const isTimeRangeAEndTime = minimizedEndTime === timeRangeA.endTime;
                if (isTimeRangeAEndTime) {
                    pingA++;
                } else {
                    pingB++;
                }
            }
        }

        return intersectTimeRanges;
    }

    compareTimeSlot(
        timeSlotStringA: string,
        timeSlotStringB: string,
        minimum = TimeSlotCompare.MIN
    ): string {
        const [ AHourString, AMinuteString ] = timeSlotStringA.split(':');
        const [ BHourString, BMinuteString ] = timeSlotStringB.split(':');

        const AHour = +AHourString;
        const AMinute = +AMinuteString;

        const BHour = +BHourString;
        const BMinute = +BMinuteString;

        let minTime = '';
        let maxTime = '';

        if (+AHour < +BHour) {
            minTime = timeSlotStringA;
            maxTime = timeSlotStringB;
        } else if (AHour === BHour) {
            minTime = AMinute > BMinute ? timeSlotStringB : timeSlotStringA;
            maxTime = AMinute > BMinute ? timeSlotStringA : timeSlotStringB;
        } else {
            minTime = timeSlotStringB;
            maxTime = timeSlotStringA;
        }

        return minimum === TimeSlotCompare.MIN ? minTime : maxTime;
    }

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

            const isOverlapping = (_localizedDateStartTime.getTime() <= requestedStartDateTimestamp && requestedStartDateTimestamp <= _localizedDateEndTime.getTime()) ||
                (_localizedDateStartTime.getTime() <= requestedEndDateTimestamp && requestedEndDateTimestamp <= _localizedDateEndTime.getTime());

            return isOverlapping;
        });

        return overlappingDateOverride;
    }

    /**
     * check boolean value by overlapping or not
     *
     * @param timezone
     * @param overrides
     * @param requestedStartDateTimestamp The scheduled event start time requested by the invitee
     * @param requestedEndDateTimestamp The scheduled event end time requested by the invitee
     * @returns true: overlapping / false: not overlapping
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

                return _startDateTime.getTime() <= requestedStartDateTimestamp &&
                    requestedEndDateTimestamp <= _endDateTime.getTime();
            });

            matchedTimeRange = !!_foundOverlappingTimeRange;
        } else {
            const targetNextDateTimestamp = new Date().setDate(new Date(_targetDate).getDate() + 1);
            const targetDateTimestamp = _targetDate.getTime();

            matchedTimeRange =
            (targetDateTimestamp <= requestedStartDateTimestamp && requestedStartDateTimestamp <= targetNextDateTimestamp)
            || (targetDateTimestamp <= requestedEndDateTimestamp && requestedEndDateTimestamp <= targetNextDateTimestamp);
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

    isTimeOverlappingWithAvailableTimeRange(
        dateTime: Date,
        timezone: string,
        timeRanges: TimeRange[]
    ): boolean {

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
        scheduledEvent: ScheduledEvent
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
            invitees,
            scheduledEventNotifications
        } = scheduledEvent;

        const startDate = new Date(startTimestamp);
        const endDate = new Date(endTimestamp);

        const inviteeName = invitees[0].name;
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
                name: host.name ?? ''
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

    timeToNumber(timeString: string): {
        hour: number;
        minutes: number;
    } {
        const [ hourString, minutesString ] = timeString.split(':');
        const hour = +hourString % 24;
        const minutes = +minutesString % 60;
        return {
            hour,
            minutes
        };
    }
}
