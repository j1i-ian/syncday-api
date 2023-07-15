import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, defer, forkJoin, from, iif, map, mergeMap, of, throwError } from 'rxjs';
import { Between, EntityManager, Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { InviteeSchedule } from '@core/interfaces/schedules/invitee-schedule.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
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
        }));
    }

    create(userWorkspace: string, eventUUID: string, newSchedule: Schedule, hostTimezone: string, host: User): Observable<Schedule> {
        return this._create(
            this.scheduleRepository.manager,
            userWorkspace,
            eventUUID,
            newSchedule,
            hostTimezone,
            host
        );
    }

    _create(
        entityManager: EntityManager,
        userWorkspace: string,
        eventUUID: string,
        newSchedule: Schedule,
        hostTimezone: string,
        host: User
    ): Observable<Schedule> {

        const _scheduleRepository = entityManager.getRepository(Schedule);

        const loadUserWorkspace$ = from(
            this.eventsService.findOneByUserWorkspaceAndUUID(userWorkspace, eventUUID)
        );

        const loadGoogleCalendarIntegration$ = from(this.googleCalendarIntegrationsService.findOne({
            outboundWriteSync: true,
            userWorkspace
        }));

        return loadUserWorkspace$.pipe(
            mergeMap(
                (event) => forkJoin([
                    this.availabilityRedisRepository.getAvailabilityBody(host.uuid, event.availability.uuid),
                    of(this.utilService.getPatchedScheduledEvent(event, newSchedule)),
                    loadGoogleCalendarIntegration$
                ])
            ),
            mergeMap(
                ([availabilityBody, patchedSchedule, loadedGoogleCalendarIntegrationOrNull]) =>
                    this.validate(
                        patchedSchedule,
                        hostTimezone,
                        availabilityBody,
                        loadedGoogleCalendarIntegrationOrNull?.id
                    ).pipe(
                        mergeMap((patchedSchedule) => {

                            if (loadedGoogleCalendarIntegrationOrNull) {
                                const generatedGoogleMeetLink = this.utilService.generenateGoogleMeetLink();
                                const syncdayGoogleMeetConferenceLink: ConferenceLink = {
                                    type: IntegrationVendor.GOOGLE,
                                    serviceName: 'Google Meet',
                                    link: generatedGoogleMeetLink
                                };
                                newSchedule.conferenceLinks = [syncdayGoogleMeetConferenceLink];
                            }

                            return from(_scheduleRepository.save(patchedSchedule));
                        }),
                        mergeMap((createdSchedule) =>
                            this.scheduleRedisRepository.save(createdSchedule.uuid, {
                                inviteeAnswers: newSchedule.inviteeAnswers,
                                scheduledNotificationInfo: newSchedule.scheduledNotificationInfo
                            }).pipe(map((_createdScheduleBody) => {
                                createdSchedule.inviteeAnswers = _createdScheduleBody.inviteeAnswers as InviteeAnswer[];
                                createdSchedule.scheduledNotificationInfo = _createdScheduleBody.scheduledNotificationInfo;

                                return createdSchedule;
                            }))
                        ),
                        mergeMap((createdSchedule) =>
                            loadedGoogleCalendarIntegrationOrNull ?
                                from(this.googleCalendarIntegrationsService.createGoogleCalendarEvent(
                                    (loadedGoogleCalendarIntegrationOrNull).googleIntegration,
                                    (loadedGoogleCalendarIntegrationOrNull),
                                    hostTimezone,
                                    createdSchedule
                                )).pipe(map(() => createdSchedule)) :
                                of(createdSchedule)
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
        hostTimezone: string,
        availabilityBody: AvailabilityBody,
        googleCalendarIntegrationId?: number | undefined
    ): Observable<Schedule> {

        const { scheduledTime, scheduledBufferTime } = schedule;
        const { startBufferTimestamp, endBufferTimestamp } = scheduledBufferTime;
        const { startTimestamp, endTimestamp } = scheduledTime;

        const ensuredBufferStartDatetime = startBufferTimestamp && new Date(startBufferTimestamp);
        const ensuredBufferEndDatetime = endBufferTimestamp && new Date(endBufferTimestamp);

        const ensuredStartDateTime = ensuredBufferStartDatetime ?? new Date(startTimestamp);
        const ensuredStartDateTimestamp = ensuredStartDateTime.getTime();
        const ensuredEndDateTime = ensuredBufferEndDatetime ?? new Date(endTimestamp);
        const ensuredEndDateTimestamp = ensuredEndDateTime.getTime();

        const isNotConcatenatedTimes = ensuredEndDateTimestamp <= ensuredStartDateTimestamp;
        const isPast = this._isPastTimestamp(ensuredStartDateTimestamp, ensuredEndDateTimestamp);

        const { availableTimes, overrides } = availabilityBody;

        const isTimeOverlappingWithOverrides = this._isTimeOverlappingWithOverrides(
            hostTimezone,
            overrides,
            ensuredStartDateTimestamp,
            ensuredEndDateTimestamp
        );
        const isNotTimeOverlappingWithOverrides = !isTimeOverlappingWithOverrides;

        const isTimeOverlappingWithAvailableTimes = this._isTimeOverlappingWithAvailableTimes(
            availableTimes,
            hostTimezone,
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
                    () => !loadedScheduleOrNull && !loadedGoogleIntegrationScheduleOrNull,
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

    _isTimeOverlappingWithOverrides(
        timezone: string,
        overrides: OverridedAvailabilityTime[],
        startDateTimestamp: number,
        endDateTimestamp: number
    ): boolean {

        const isTimeOverlappedWithOverrides = overrides
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

        return isTimeOverlappedWithOverrides;
    }

    _isTimeOverlappingWithAvailableTimes(
        availableTimes: AvailableTime[],
        hostTimezone: string,
        startDateTime: Date,
        endDateTime: Date
    ): boolean {

        const startTimeString = this.utilService.dateToTimeString(startDateTime, hostTimezone);
        const endTimeString = this.utilService.dateToTimeString(endDateTime, hostTimezone);

        const localizedStartDateTime = this.utilService.localizeDateTime(
            startDateTime,
            hostTimezone,
            startTimeString
        );

        const localizedEndDateTime = this.utilService.localizeDateTime(
            endDateTime,
            hostTimezone,
            endTimeString
        );

        const startWeekday = localizedStartDateTime.getDay();
        const endWeekday = localizedEndDateTime.getDay();

        const startWeekdayAvailableTime = availableTimes.find((_availableTime) => _availableTime.day === startWeekday);
        const endWeekdayAvailableTime = availableTimes.find((_availableTime) => _availableTime.day === endWeekday);

        let isTimeOverlapping;

        if (startWeekdayAvailableTime && endWeekdayAvailableTime) {
            const isTimeOverlappingWithStartDateTime = this._isTimeOverlappingWithAvailableTimeRange(localizedStartDateTime, hostTimezone, startWeekdayAvailableTime.timeRanges);
            const isTimeOverlappingWithEndDateTime = this._isTimeOverlappingWithAvailableTimeRange(localizedStartDateTime, hostTimezone, endWeekdayAvailableTime.timeRanges);

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

            return localizedTimeRangeStartDateTime.getTime() < dateTime.getTime() &&
                dateTime.getTime() < localizedTimeRangeEndDateTime.getTime();
        });

        return isTimeOverlappingDateTime;
    }
}
