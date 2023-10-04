import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, defer, filter, first, forkJoin, from, iif, map, mergeMap, of, throwError } from 'rxjs';
import { Between, EntityManager, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { InviteeSchedule } from '@core/interfaces/schedules/invitee-schedule.interface';
import { IntegrationSchedulesService } from '@core/interfaces/integrations/integration-schedules.abstract-service';
import { ScheduledEventSearchOption } from '@interfaces/schedules/scheduled-event-search-option.interface';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { UtilService } from '@services/util/util.service';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { NativeSchedulesService } from '@services/schedules/native-schedules.service';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { Schedule } from '@entity/schedules/schedule.entity';
import { User } from '@entity/users/user.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { AvailableTime } from '@entity/availability/availability-time.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { InviteeAnswer } from '@entity/schedules/invitee-answer.entity';
import { GoogleIntegrationSchedule } from '@entity/integrations/google/google-integration-schedule.entity';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';

/**
 * TODO: Apply prototype design pattern
 */
@Injectable()
export class GlobalSchedulesService {

    constructor(
        private readonly integrationsServiceLocator: IntegrationsServiceLocator,
        private readonly utilService: UtilService,
        private readonly eventsService: EventsService,
        private readonly nativeSchedulesService: NativeSchedulesService,
        private readonly calendarIntegrationsServiceLocator: CalendarIntegrationsServiceLocator,
        private readonly scheduleRedisRepository: SchedulesRedisRepository,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectRepository(Schedule) private readonly scheduleRepository: Repository<Schedule>,
        @InjectRepository(GoogleIntegrationSchedule) private readonly googleIntegrationScheduleRepository: Repository<GoogleIntegrationSchedule>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {
        this.allIntegrationSchedulesServices = this.integrationsServiceLocator.getAllIntegrationSchedulesService();
    }

    allIntegrationSchedulesServices: IntegrationSchedulesService[];

    search(scheduleSearchOption: Partial<ScheduledEventSearchOption>): Observable<InviteeSchedule[]> {

        const syncNativeSchedule$ = this.nativeSchedulesService.search(scheduleSearchOption);

        const integrationSchedules$ = this.allIntegrationSchedulesServices.map(
            (_integrationSchedulesService) =>
                _integrationSchedulesService.search(
                    scheduleSearchOption
                )
        );

        return forkJoin([syncNativeSchedule$].concat(integrationSchedules$)).pipe(
            map(
                (allSchedulesArray) =>
                    allSchedulesArray.reduce(
                        (_allSchedules, _schedules) => _allSchedules.concat(_schedules), []
                    )
            )
        );
    }

    findOne(scheduleUUID: string): Observable<Schedule> {
        return from(this.scheduleRepository.findOneByOrFail({
            uuid: scheduleUUID
        })).pipe(
            mergeMap((scheduledEvent) => this.scheduleRedisRepository.getScheduleBody(scheduledEvent.uuid)
                .pipe(
                    map((scheduleBody) => {
                        scheduledEvent.inviteeAnswers = scheduleBody.inviteeAnswers;
                        return scheduledEvent;
                    })
                )
            )
        );
    }

    create(userWorkspace: string, eventUUID: string, newSchedule: Schedule, host: User): Observable<Schedule> {
        return this._create(
            this.scheduleRepository.manager,
            userWorkspace,
            eventUUID,
            newSchedule,
            host
        );
    }

    _create(
        entityManager: EntityManager,
        userWorkspace: string,
        eventUUID: string,
        newSchedule: Schedule,
        host: User
    ): Observable<Schedule> {

        const _scheduleRepository = entityManager.getRepository(Schedule);

        const loadedEventByUserWorkspace$ = from(
            this.eventsService.findOneByUserWorkspaceAndUUID(userWorkspace, eventUUID)
        );

        const calendarIntegrationServices = this.calendarIntegrationsServiceLocator.getAllCalendarIntegrationServices();
        const conferenceLinkIntegrationServices = this.integrationsServiceLocator.getAllConferenceLinkIntegrationService();

        const loadedOutboundCalendarIntegration$ = from(calendarIntegrationServices)
            .pipe(
                mergeMap(
                    (calendarIntegrationService) => calendarIntegrationService.findOne({
                        outboundWriteSync: true,
                        userId: host.id
                    })
                ),
                filter((_calendarIntegration) => !!_calendarIntegration)
            );

        return loadedEventByUserWorkspace$.pipe(
            mergeMap(
                (event) => forkJoin([
                    this.availabilityRedisRepository.getAvailabilityBody(host.uuid, event.availability.uuid),
                    of(this.utilService.getPatchedScheduledEvent(
                        host,
                        event,
                        newSchedule,
                        userWorkspace,
                        event.availability.timezone
                    )),
                    loadedOutboundCalendarIntegration$,
                    of(event.availability.timezone),
                    of(event.contacts)
                ])
            ),
            mergeMap(
                ([
                    availabilityBody,
                    patchedSchedule,
                    loadedOutboundCalendarIntegrationOrNull,
                    availabilityTimezone,
                    contacts
                ]) =>
                    this.validate(
                        patchedSchedule,
                        availabilityTimezone,
                        availabilityBody,
                        loadedOutboundCalendarIntegrationOrNull?.id
                    ).pipe(
                        mergeMap((patchedSchedule) => {

                            if (!loadedOutboundCalendarIntegrationOrNull) {
                                return of(patchedSchedule);
                            } else {

                                const outboundCalendarIntegrationVendor = loadedOutboundCalendarIntegrationOrNull.getIntegrationVendor();

                                const calendarIntegrationService = this.calendarIntegrationsServiceLocator.getCalendarIntegrationService(outboundCalendarIntegrationVendor);

                                return from(
                                    calendarIntegrationService.createCalendarEvent(
                                        (loadedOutboundCalendarIntegrationOrNull).getIntegration(),
                                        (loadedOutboundCalendarIntegrationOrNull),
                                        availabilityTimezone,
                                        patchedSchedule
                                    )
                                ).pipe(
                                    map((createdCalendarEvent) => {

                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        patchedSchedule.iCalUID = (createdCalendarEvent as any).iCalUID as string;

                                        return createdCalendarEvent;
                                    }),
                                    mergeMap((createdCalendarEvent) => from(conferenceLinkIntegrationServices)
                                        .pipe(
                                            mergeMap(
                                                (conferenceLinkIntegrationService) => {
                                                    const integrationVendor = conferenceLinkIntegrationService.getIntegrationVendor();

                                                    const integrationFactory = this.integrationsServiceLocator.getIntegrationFactory(integrationVendor);

                                                    const loadedIntegration$ = from(integrationFactory.findOne({
                                                        userId: host.id
                                                    }));

                                                    return loadedIntegration$.pipe(
                                                        mergeMap((loadedIntegration) => {

                                                            const createMeeting$ = loadedIntegration?
                                                                from(conferenceLinkIntegrationService.createMeeting(
                                                                    loadedIntegration,
                                                                    contacts,
                                                                    patchedSchedule,
                                                                    availabilityTimezone,
                                                                    createdCalendarEvent
                                                                )) : of(null);

                                                            return createMeeting$;
                                                        }),
                                                        mergeMap((createdConferenceLink) => {

                                                            if (createdConferenceLink) {
                                                                patchedSchedule.conferenceLinks.push(createdConferenceLink);
                                                            }

                                                            return of(createdCalendarEvent);
                                                        })
                                                    );
                                                }
                                            )
                                        )),
                                    mergeMap((createdCalendarEvent) => from(calendarIntegrationService.patchCalendarEvent(
                                        loadedOutboundCalendarIntegrationOrNull.getIntegration(),
                                        loadedOutboundCalendarIntegrationOrNull,
                                        patchedSchedule,
                                        createdCalendarEvent
                                    )).pipe(
                                        map(() => patchedSchedule)
                                    ))
                                );
                            }
                        }),
                        first(),
                        mergeMap((patchedSchedule) => from(_scheduleRepository.save(patchedSchedule))),
                        mergeMap((createdSchedule) =>
                            this.scheduleRedisRepository.save(createdSchedule.uuid, {
                                inviteeAnswers: newSchedule.inviteeAnswers,
                                scheduledNotificationInfo: newSchedule.scheduledNotificationInfo
                            }).pipe(map((_createdScheduleBody) => {
                                createdSchedule.inviteeAnswers = _createdScheduleBody.inviteeAnswers as InviteeAnswer[];
                                createdSchedule.scheduledNotificationInfo = _createdScheduleBody.scheduledNotificationInfo;

                                return createdSchedule;
                            }))
                        )
                    )
            )
        );
    }

    _update(
        entityManager: EntityManager,
        scheduleId: number,
        partialSchedule: Partial<Schedule>
    ): Observable<boolean> {

        const _scheduleRepository = entityManager.getRepository(Schedule);

        return from(_scheduleRepository.update(scheduleId, partialSchedule))
            .pipe(
                map((updateResult) => !!updateResult.affected && updateResult.affected > 0)
            );
    }

    validate(
        schedule: Schedule,
        availabilityTimezone: string,
        availabilityBody: AvailabilityBody,
        googleCalendarIntegrationId?: number | undefined
    ): Observable<Schedule> {

        const { scheduledTime, scheduledBufferTime } = schedule;
        const { startBufferTimestamp, endBufferTimestamp } = scheduledBufferTime;
        const { startTimestamp, endTimestamp } = scheduledTime;

        const ensuredBufferStartDatetime = startBufferTimestamp && new Date(startBufferTimestamp);
        const ensuredBufferEndDatetime = endBufferTimestamp && new Date(endBufferTimestamp);

        // for exclusive query, reduce 1 second
        const ensuredStartDateTime = ensuredBufferStartDatetime ?? new Date(startTimestamp);
        ensuredStartDateTime.setSeconds(ensuredStartDateTime.getSeconds() + 1);
        const ensuredStartDateTimestamp = ensuredStartDateTime.getTime();

        const ensuredEndDateTime = ensuredBufferEndDatetime ?? new Date(endTimestamp);
        ensuredEndDateTime.setSeconds(ensuredEndDateTime.getSeconds() - 1);
        const ensuredEndDateTimestamp = ensuredEndDateTime.getTime();

        const isNotConcatenatedTimes = ensuredEndDateTimestamp <= ensuredStartDateTimestamp;
        const isPast = this._isPastTimestamp(ensuredStartDateTimestamp, ensuredEndDateTimestamp);

        const { availableTimes, overrides } = availabilityBody;

        const overlappingDateOverride = this._findOverlappingDateOverride(
            availabilityTimezone,
            overrides,
            ensuredStartDateTimestamp,
            ensuredEndDateTimestamp
        );

        let isInvalidTimeOverlappingWithOverrides = true;
        let _isUnavailableDateOverride;
        let _isTimeOverlappingWithAvailableTimeOverrides;
        let _isTimeOverlappingWithAvailableTimes;

        if (overlappingDateOverride) {
            // checking unavailable override
            _isUnavailableDateOverride = overlappingDateOverride.timeRanges.length === 0;

            if (_isUnavailableDateOverride) {
                isInvalidTimeOverlappingWithOverrides = true;
            } else {
                // or checking available override time match
                _isTimeOverlappingWithAvailableTimeOverrides = this._isTimeOverlappingWithAvailableTimeOverrides(
                    availabilityTimezone,
                    overlappingDateOverride,
                    ensuredStartDateTimestamp,
                    ensuredEndDateTimestamp
                );

                isInvalidTimeOverlappingWithOverrides = !_isTimeOverlappingWithAvailableTimeOverrides;
            }

        } else {
            // checking available time
            _isTimeOverlappingWithAvailableTimes = this._isTimeOverlappingWithAvailableTimes(
                availableTimes,
                availabilityTimezone,
                ensuredStartDateTime,
                ensuredEndDateTime
            );
            isInvalidTimeOverlappingWithOverrides = !_isTimeOverlappingWithAvailableTimes;
        }

        const isInvalid = isPast || isNotConcatenatedTimes || isInvalidTimeOverlappingWithOverrides;

        if (isInvalid) {

            const results = `isPast: ${String(isPast)},
            isNotConcatenatedTimes: ${String(isNotConcatenatedTimes)},
            (isInvalidTimeOverlappingWithOverrides: ${String(isInvalidTimeOverlappingWithOverrides)}
                && _isUnavailableDateOverride: ${String(_isUnavailableDateOverride)},
                && _isTimeOverlappingWithAvailableTimeOverrides: ${String(_isTimeOverlappingWithAvailableTimeOverrides)},
                && _isTimeOverlappingWithAvailableTimes: ${String(_isTimeOverlappingWithAvailableTimes)})`;

            this.logger.debug(
                `invalid reason: ${results}`
            );
            throw new CannotCreateByInvalidTimeRange();
        }

        const scheduleConditionOptions = this._getScheduleConflictCheckOptions(
            ensuredStartDateTime,
            ensuredEndDateTime,
            {
                eventDetailId: schedule.eventDetailId
            }
        );

        const googleIntegrationScheduleConditionOptions = this._getScheduleConflictCheckOptions(
            ensuredStartDateTime,
            ensuredEndDateTime,
            {
                googleCalendarIntegrationId
            }
        );
        const loadedGoogleIntegrationSchedules$ = defer(() => from(
            this.googleIntegrationScheduleRepository.findOneBy(
                googleIntegrationScheduleConditionOptions
            ))
        );

        // investigate to find conflicted schedules
        const loadedSchedules$ = defer(() => from(this.scheduleRepository.findOneBy(
            scheduleConditionOptions
        )));

        const scheduleObservables = googleCalendarIntegrationId ?
            [loadedSchedules$, loadedGoogleIntegrationSchedules$] :
            [loadedSchedules$];

        return forkJoin(scheduleObservables).pipe(
            mergeMap(([loadedScheduleOrNull, loadedGoogleIntegrationScheduleOrNull]) =>
                iif(
                    () => {
                        this.logger.debug({
                            message: 'a previous engagement is detected: !loadedScheduleOrNull && !loadedGoogleIntegrationScheduleOrNull is true',
                            loadedScheduleOrNull,
                            loadedGoogleIntegrationScheduleOrNull
                        });
                        return !loadedScheduleOrNull && !loadedGoogleIntegrationScheduleOrNull;
                    },
                    of(schedule),
                    throwError(() => new CannotCreateByInvalidTimeRange())
                )
            )
        );
    }

    _getScheduleConflictCheckOptions(
        startDateTime: Date,
        endDateTime: Date,
        additionalOption?: FindOptionsWhere<Schedule> | FindOptionsWhere<GoogleIntegrationSchedule> | undefined
    ): Array<FindOptionsWhere<InviteeSchedule>> {
        return [
            {
                scheduledTime: {
                    startTimestamp: MoreThanOrEqual(startDateTime),
                    endTimestamp: LessThanOrEqual(endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledTime: {
                    startTimestamp: LessThanOrEqual(startDateTime),
                    endTimestamp: MoreThanOrEqual(endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledBufferTime: {
                    startBufferTimestamp: Between(startDateTime, endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledBufferTime: {
                    endBufferTimestamp: Between(startDateTime, endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledTime: {
                    startTimestamp: Between(startDateTime, endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledTime: {
                    endTimestamp: Between(startDateTime, endDateTime)
                },
                ...additionalOption
            }
        ];
    }

    _isPastTimestamp(startDateTimestamp: number, ensuredEndDateTimestamp: number): boolean {
        return startDateTimestamp < Date.now() ||
            ensuredEndDateTimestamp < Date.now();
    }

    _findOverlappingDateOverride(
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

            const _localizedDateStartTime = this.utilService.localizeDateTime(
                new Date(_targetDate),
                timezone,
                _dateStartTime
            );
            const _localizedDateEndTime = this.utilService.localizeDateTime(
                new Date(_targetDate),
                timezone,
                _dateEndTime
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
    _isTimeOverlappingWithAvailableTimeOverrides(
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
                const _startDateTime = this.utilService.localizeDateTime(
                    new Date(_targetDate),
                    timezone,
                    startTime
                );
                const _endDateTime = this.utilService.localizeDateTime(
                    new Date(_targetDate),
                    timezone,
                    endTime
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

    _isTimeOverlappingWithAvailableTimes(
        availableTimes: AvailableTime[],
        availabilityTimezone: string,
        startDateTime: Date,
        endDateTime: Date
    ): boolean {

        const startTimeString = this.utilService.dateToTimeString(startDateTime, availabilityTimezone);
        const endTimeString = this.utilService.dateToTimeString(endDateTime, availabilityTimezone);

        const localizedStartDateTime = this.utilService.localizeDateTime(
            startDateTime,
            availabilityTimezone,
            startTimeString
        );

        const localizedEndDateTime = this.utilService.localizeDateTime(
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
            const isTimeOverlappingWithStartDateTime = this._isTimeOverlappingWithAvailableTimeRange(
                localizedStartDateTime,
                availabilityTimezone,
                startWeekdayAvailableTime.timeRanges
            );
            const isTimeOverlappingWithEndDateTime = this._isTimeOverlappingWithAvailableTimeRange(
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

    _isTimeOverlappingWithAvailableTimeRange(dateTime: Date, timezone: string, timeRanges: TimeRange[]): boolean {

        const isTimeOverlappingDateTime = timeRanges.some((_timeRange) => {
            const {
                startTime: timeRangeStartTime,
                endTime: timeRangeEndTime
            } = _timeRange as { startTime: string; endTime: string };

            const localizedTimeRangeStartDateTime = this.utilService.localizeDateTime(
                dateTime,
                timezone,
                timeRangeStartTime
            );

            const localizedTimeRangeEndDateTime = this.utilService.localizeDateTime(
                dateTime,
                timezone,
                timeRangeEndTime
            );

            return localizedTimeRangeStartDateTime.getTime() <= dateTime.getTime() &&
                dateTime.getTime() <= localizedTimeRangeEndDateTime.getTime();
        });

        return isTimeOverlappingDateTime;
    }
}
