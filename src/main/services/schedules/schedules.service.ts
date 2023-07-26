import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, defer, forkJoin, from, iif, map, mergeMap, of, throwError } from 'rxjs';
import { Between, EntityManager, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { calendar_v3 } from 'googleapis';
import { InviteeSchedule } from '@core/interfaces/schedules/invitee-schedule.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { UtilService } from '@services/util/util.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { Schedule } from '@entity/schedules/schedule.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { User } from '@entity/users/user.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { AvailableTime } from '@entity/availability/availability-time.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { InviteeAnswer } from '@entity/schedules/invitee-answer.entity';
import { ConferenceLink } from '@entity/schedules/conference-link.entity';
import { ScheduleSearchOption } from '@app/interfaces/schedules/schedule-search-option.interface';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';

@Injectable()
export class SchedulesService {

    constructor(
        private readonly utilService: UtilService,
        private readonly eventsService: EventsService,
        private readonly scheduleRedisRepository: SchedulesRedisRepository,
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectRepository(Schedule) private readonly scheduleRepository: Repository<Schedule>,
        @InjectRepository(GoogleIntegrationSchedule) private readonly googleIntegrationScheduleRepository: Repository<GoogleIntegrationSchedule>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    search(scheduleSearchOption: Partial<ScheduleSearchOption>): Observable<InviteeSchedule[]> {

        const {
            workspace: hostWorkspace,
            eventUUID
        } = scheduleSearchOption;

        const inviteeSchedule$ = defer(() => from(this.scheduleRepository.findBy({
            eventDetail: {
                event: {
                    uuid: eventUUID
                }
            },
            host: {
                workspace: hostWorkspace
            }
        })));

        const googleIntegrationSchedule$ = defer(() => from(this.googleIntegrationScheduleRepository.findBy({
            host: {
                workspace: hostWorkspace
            }
        })));

        return forkJoin([inviteeSchedule$, googleIntegrationSchedule$]).pipe(
            map(([inviteeSchedules, googleCalendarSchedules]) => [...inviteeSchedules, ...googleCalendarSchedules])
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

        const loadedGoogleCalendarIntegration$ = from(this.googleCalendarIntegrationsService.findOne({
            outboundWriteSync: true,
            userWorkspace
        }));

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
                    loadedGoogleCalendarIntegration$,
                    of(event.availability.timezone)
                ])
            ),
            mergeMap(
                ([availabilityBody, patchedSchedule, loadedGoogleCalendarIntegrationOrNull, availabilityTimezone]) =>
                    this.validate(
                        patchedSchedule,
                        availabilityTimezone,
                        availabilityBody,
                        loadedGoogleCalendarIntegrationOrNull?.id
                    ).pipe(
                        mergeMap((patchedSchedule) =>
                            loadedGoogleCalendarIntegrationOrNull ?
                                from(this.googleCalendarIntegrationsService.createGoogleCalendarEvent(
                                    (loadedGoogleCalendarIntegrationOrNull).googleIntegration,
                                    (loadedGoogleCalendarIntegrationOrNull),
                                    availabilityTimezone,
                                    patchedSchedule
                                )).pipe(mergeMap((createdGoogleCalendarEvent) => {

                                    if (this.hasScheduleLink(patchedSchedule)) {

                                        const googleMeetConferenceLink = createdGoogleCalendarEvent.conferenceData as calendar_v3.Schema$ConferenceData;
                                        const generatedGoogleMeetLink = (googleMeetConferenceLink.entryPoints as calendar_v3.Schema$EntryPoint[])[0].uri;
                                        const convertedConferenceLink: ConferenceLink = {
                                            type: IntegrationVendor.GOOGLE,
                                            serviceName: 'Google Meet',
                                            link: generatedGoogleMeetLink
                                        };
                                        patchedSchedule.conferenceLinks = [ convertedConferenceLink ];

                                        return this.googleCalendarIntegrationsService.patchGoogleCalendarEvent(
                                            (loadedGoogleCalendarIntegrationOrNull).googleIntegration,
                                            (loadedGoogleCalendarIntegrationOrNull),
                                            createdGoogleCalendarEvent.id as string,
                                            patchedSchedule
                                        );
                                    } else {
                                        return of(patchedSchedule);
                                    }
                                }), map(() => patchedSchedule)) :
                                of(patchedSchedule)
                        ),
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

    hasScheduleLink(schedule: Schedule): boolean {
        return schedule.contacts[0].type === ContactType.GOOGLE_MEET;
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

        const isTimeOverlappingWithOverrides = this._isTimeOverlappingWithOverrides(
            availabilityTimezone,
            overrides,
            ensuredStartDateTimestamp,
            ensuredEndDateTimestamp
        );
        const isNotTimeOverlappingWithOverrides = !isTimeOverlappingWithOverrides;

        const isTimeOverlappingWithAvailableTimes = this._isTimeOverlappingWithAvailableTimes(
            availableTimes,
            availabilityTimezone,
            ensuredStartDateTime,
            ensuredEndDateTime
        );
        const isNotTimeOverlappingWithAvailableTimes = !isTimeOverlappingWithAvailableTimes;

        const isInvalid = isPast || isNotConcatenatedTimes || (isNotTimeOverlappingWithOverrides && isNotTimeOverlappingWithAvailableTimes);

        if (isInvalid) {

            const results = `isPast: ${String(isPast)},
            isNotConcatenatedTimes: ${String(isNotConcatenatedTimes)},
            (isNotTimeOverlappingWithOverrides && isNotTimeOverlappingWithAvailableTimes: ${String(isNotTimeOverlappingWithOverrides)}
                && ${String(isNotTimeOverlappingWithAvailableTimes)}`;

            this.logger.debug(
                `invalid reason: ${results}`
            );
            throw new CannotCreateByInvalidTimeRange();
        }

        const loadedGoogleIntegrationSchedules$ = defer(() => from(this.googleIntegrationScheduleRepository.findOneBy(
            [
                {
                    scheduledTime: {
                        startTimestamp: MoreThanOrEqual(ensuredStartDateTime),
                        endTimestamp: LessThanOrEqual(ensuredEndDateTime)
                    },
                    googleCalendarIntegrationId
                },
                {
                    scheduledTime: {
                        startTimestamp: LessThanOrEqual(ensuredStartDateTime),
                        endTimestamp: MoreThanOrEqual(ensuredEndDateTime)
                    },
                    googleCalendarIntegrationId
                },
                {
                    scheduledBufferTime: {
                        startBufferTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    googleCalendarIntegrationId
                },
                {
                    scheduledBufferTime: {
                        endBufferTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    googleCalendarIntegrationId
                },
                {
                    scheduledTime: {
                        startTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    googleCalendarIntegrationId
                },
                {
                    scheduledTime: {
                        endTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    googleCalendarIntegrationId
                }
            ]
        )));

        const loadedSchedules$ = defer(() => from(this.scheduleRepository.findOneBy(
            [
                {
                    scheduledTime: {
                        startTimestamp: MoreThanOrEqual(ensuredStartDateTime),
                        endTimestamp: LessThanOrEqual(ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledTime: {
                        startTimestamp: LessThanOrEqual(ensuredStartDateTime),
                        endTimestamp: MoreThanOrEqual(ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledBufferTime: {
                        startBufferTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledBufferTime: {
                        endBufferTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledTime: {
                        startTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledTime: {
                        endTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                }
            ]
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

    _isPastTimestamp(startDateTimestamp: number, ensuredEndDateTimestamp: number): boolean {
        return startDateTimestamp < Date.now() ||
            ensuredEndDateTimestamp < Date.now();
    }

    /**
     * This method returns true if given params are valid
     * nor returns false for invalid
     *
     * @param timezone
     * @param overrides
     * @param startDateTimestamp
     * @param endDateTimestamp
     * @returns
     */
    _isTimeOverlappingWithOverrides(
        timezone: string,
        overrides: OverridedAvailabilityTime[],
        startDateTimestamp: number,
        endDateTimestamp: number
    ): boolean {

        let isTimeOverlappedWithOverrides: boolean;

        if (overrides.length > 0) {
            isTimeOverlappedWithOverrides = overrides
                .some(({
                    targetDate: _targetDate,
                    timeRanges: _timeRanges
                }) => _timeRanges.some((__timeRange) => {
                    const { startTime, endTime } = __timeRange as { startTime: string; endTime: string };
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

                    return _startDateTime.getTime() <= startDateTimestamp &&
                        endDateTimestamp <= _endDateTime.getTime();
                }));
        } else {
            isTimeOverlappedWithOverrides = true;
        }

        return isTimeOverlappedWithOverrides;
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

        const startWeekday = localizedStartDateTime.getDay();
        const endWeekday = localizedEndDateTime.getDay();

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
