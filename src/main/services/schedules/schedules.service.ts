import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, from, iif, map, mergeMap, of, throwError } from 'rxjs';
import { Between, Repository } from 'typeorm';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { UtilService } from '@services/util/util.service';
import { Schedule } from '@entity/schedules/schedule.entity';
import { ScheduleSearchOption } from '@app/interfaces/schedules/schedule-search-option.interface';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';

@Injectable()
export class SchedulesService {

    constructor(
        private readonly utilService: UtilService,
        private readonly eventsService: EventsService,
        private readonly scheduleRedisRepository: SchedulesRedisRepository,
        @InjectRepository(Schedule) private readonly scheduleRepository: Repository<Schedule>
    ) {}

    search(scheduleSearchOption: ScheduleSearchOption): Observable<Schedule[]> {
        return from(this.scheduleRepository.findBy({
            eventDetail: {
                event: {
                    uuid: scheduleSearchOption.eventUUID
                }
            }
        }));
    }

    create(userWorkspace: string, eventUUID: string, newSchedule: Schedule): Observable<Schedule> {

        return from(
            this.eventsService.findOneByUserWorkspaceAndUUID(userWorkspace, eventUUID)
        ).pipe(
            map((event) => this.utilService.getPatchedScheduledEvent(event, newSchedule)),
            mergeMap((patchedSchedule) => this.validate(patchedSchedule)),
            mergeMap((patchedSchedule) => this.scheduleRepository.save(patchedSchedule)),
            mergeMap((createdSchedule) =>
                this.scheduleRedisRepository.save(createdSchedule.uuid, {
                    inviteeAnswers: newSchedule.inviteeAnswers,
                    scheduledNotificationInfo: newSchedule.scheduledNotificationInfo
                }).pipe(map(() => createdSchedule))
            )
        );
    }

    validate(schedule: Schedule): Observable<Schedule> {

        const { scheduledTime, scheduledBufferTime } = schedule;
        const { startBufferTimestamp, endBufferTimestamp } = scheduledBufferTime;
        const { startTimestamp, endTimestamp } = scheduledTime;

        const ensuredStartDatetime = startBufferTimestamp && new Date(startBufferTimestamp);
        const ensuredEndDatetime = endBufferTimestamp && new Date(endBufferTimestamp);

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
                        startTimestamp: Between(new Date(startTimestamp), new Date(endTimestamp))
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledTime: {
                        endTimestamp: Between(new Date(startTimestamp), new Date(endTimestamp))
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
