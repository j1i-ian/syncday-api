import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, from, map, mergeMap } from 'rxjs';
import { Repository } from 'typeorm';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { UtilService } from '@services/util/util.service';
import { Schedule } from '@entity/schedules/schedule.entity';
import { ScheduleSearchOption } from '@app/interfaces/schedules/schedule-search-option.interface';

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
            mergeMap((patchedSchedule) => this.scheduleRepository.save(patchedSchedule)),
            mergeMap((createdSchedule) =>
                this.scheduleRedisRepository.save(createdSchedule.uuid, {
                    inviteeAnswers: newSchedule.inviteeAnswers,
                    scheduledNotificationInfo: newSchedule.scheduledNotificationInfo
                }).pipe(map(() => createdSchedule))
            )
        );
    }
}
