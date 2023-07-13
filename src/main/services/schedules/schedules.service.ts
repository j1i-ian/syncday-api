import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, forkJoin, from, iif, map, mergeMap, of, throwError } from 'rxjs';
import { Between, EntityManager, Repository } from 'typeorm';
import { InviteeSchedule } from '@core/interfaces/schedules/invitee-schedule.interface';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { UtilService } from '@services/util/util.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { Schedule } from '@entity/schedules/schedule.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { AvailableTime } from '@entity/availability/availability-time.entity';
import { TimeRange } from '@entity/events/time-range.entity';
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
        @InjectRepository(GoogleIntegrationSchedule) private readonly googleIntegrationScheduleRepository: Repository<GoogleIntegrationSchedule>
    ) {}

    search(scheduleSearchOption: Partial<ScheduleSearchOption>): Observable<InviteeSchedule[]> {

        const inviteeSchedule$ = from(this.scheduleRepository.findBy({
            eventDetail: {
                event: {
                    uuid: scheduleSearchOption.eventUUID
                }
            }
        }));

        const googleIntegrationSchedule$ = from(this.googleIntegrationScheduleRepository.findBy({
            googleCalendarIntegration: {
                googleIntegration: {
                    users: {
                        userSetting: {
                            workspace: scheduleSearchOption.workspace
                        }
                    }
                }
            }
        }));

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

        return from(
            this.eventsService.findOneByUserWorkspaceAndUUID(userWorkspace, eventUUID)
        ).pipe(
            mergeMap(
                (event) => forkJoin([
                    this.availabilityRedisRepository.getAvailabilityBody(host.uuid, event.availability.uuid),
                    of(this.utilService.getPatchedScheduledEvent(event, newSchedule))
                ])
            ),
            mergeMap(([availabilityBody, patchedSchedule]) => this.validate(patchedSchedule, hostTimezone, availabilityBody)),
            mergeMap((patchedSchedule) => entityManager.getRepository(Schedule).save(patchedSchedule)),
            mergeMap((createdSchedule) =>
                this.scheduleRedisRepository.save(createdSchedule.uuid, {
                    inviteeAnswers: newSchedule.inviteeAnswers,
                    scheduledNotificationInfo: newSchedule.scheduledNotificationInfo
                }).pipe(map(() => createdSchedule))
            ),
            mergeMap((createdSchedule) =>
                this.googleCalendarIntegrationsService.findOne({
                    outboundWriteSync: true,
                    userWorkspace
                }).pipe(
                    mergeMap((loadedGoogleCalendarIntegration: GoogleCalendarIntegration | null) =>
                        loadedGoogleCalendarIntegration ?
                            from(this.googleCalendarIntegrationsService.createGoogleCalendarEvent(
                                (loadedGoogleCalendarIntegration ).googleIntegration,
                                (loadedGoogleCalendarIntegration ),
                                hostTimezone,
                                createdSchedule
                            )) :
                            of({})
                    ),
                    map(() => createdSchedule)
                )
            )
        );
    }

    validate(schedule: Schedule, hostTimezone: string, availabilityBody: AvailabilityBody): Observable<Schedule> {

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
            throw new CannotCreateByInvalidTimeRange();
        }

        return from(this.scheduleRepository.findOneBy(
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
        )).pipe(
            mergeMap((loaded) =>
                iif(
                    () => !loaded,
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
