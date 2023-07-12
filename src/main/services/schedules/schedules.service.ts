import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, forkJoin, from, iif, map, mergeMap, of, throwError } from 'rxjs';
import { Between, EntityManager, Repository } from 'typeorm';
import { InviteeSchedule } from '@core/interfaces/schedules/invitee-schedule.interface';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { UtilService } from '@services/util/util.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { Schedule } from '@entity/schedules/schedule.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { ScheduleSearchOption } from '@app/interfaces/schedules/schedule-search-option.interface';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';

@Injectable()
export class SchedulesService {

    constructor(
        private readonly utilService: UtilService,
        private readonly eventsService: EventsService,
        private readonly scheduleRedisRepository: SchedulesRedisRepository,
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService,
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

    create(userWorkspace: string, eventUUID: string, newSchedule: Schedule, hostTimezone: string ): Observable<Schedule> {
        return this._create(
            this.scheduleRepository.manager,
            userWorkspace,
            eventUUID,
            newSchedule,
            hostTimezone
        );
    }

    _create(
        entityManager: EntityManager,
        userWorkspace: string,
        eventUUID: string,
        newSchedule: Schedule,
        hostTimezone: string
    ): Observable<Schedule> {

        return from(
            this.eventsService.findOneByUserWorkspaceAndUUID(userWorkspace, eventUUID)
        ).pipe(
            mergeMap((event) => of(this.utilService.getPatchedScheduledEvent(event, newSchedule))),
            mergeMap((patchedSchedule) => this.validate(patchedSchedule)),
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

    validate(schedule: Schedule): Observable<Schedule> {

        const { scheduledTime, scheduledBufferTime } = schedule;
        const { startBufferTimestamp, endBufferTimestamp } = scheduledBufferTime;
        const { startTimestamp, endTimestamp } = scheduledTime;

        const ensuredBufferStartDatetime = startBufferTimestamp && new Date(startBufferTimestamp);
        const ensuredBufferEndDatetime = endBufferTimestamp && new Date(endBufferTimestamp);

        const ensuredStartDatetime = ensuredBufferStartDatetime ?? new Date(startTimestamp);
        const ensuredEndDatetime = ensuredBufferEndDatetime ?? new Date(endTimestamp);

        if (
            ensuredStartDatetime.getTime() < Date.now() ||
            ensuredEndDatetime.getTime() < Date.now()) {
            throw new CannotCreateByInvalidTimeRange();
        }

        return from(this.scheduleRepository.findOneBy(
            [
                {
                    scheduledBufferTime: {
                        startBufferTimestamp: Between(ensuredStartDatetime, ensuredEndDatetime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledBufferTime: {
                        endBufferTimestamp: Between(ensuredStartDatetime, ensuredEndDatetime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledTime: {
                        startTimestamp: Between(ensuredStartDatetime, ensuredEndDatetime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledTime: {
                        endTimestamp: Between(ensuredStartDatetime, ensuredEndDatetime)
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
}
