import { Injectable } from '@nestjs/common';
import { Observable, defer, from } from 'rxjs';
import { FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SchedulesService } from '@core/interfaces/schedules.service.interface';
import { InviteeSchedule } from '@core/interfaces/schedules/invitee-schedule.interface';
import { ScheduledEventSearchOption } from '@interfaces/schedules/scheduled-event-search-option.interface';
import { Schedule } from '@entity/schedules/schedule.entity';

@Injectable()
export class NativeSchedulesService implements SchedulesService {

    constructor(
        @InjectRepository(Schedule) private readonly scheduleRepository: Repository<Schedule>
    ) {}

    search(scheduleSearchOption: Partial<ScheduledEventSearchOption>): Observable<InviteeSchedule[]> {

        const {
            hostUUID,
            eventUUID,
            since,
            until
        } = scheduleSearchOption;

        const defaultUntilDateTime = new Date(new Date().getDate() + 90);
        const ensuredSinceDateTime = since ? new Date(since) : new Date();
        const ensuredUntilDateTime = until ? new Date(until) : defaultUntilDateTime;

        const nativeScheduleDefaultOption: FindOptionsWhere<Schedule> = {
            host: {
                uuid: hostUUID
            },
            eventDetail: {
                event: {
                    uuid: eventUUID
                }
            }
        };

        const nativeScheduleConditionOptions: Array<FindOptionsWhere<Schedule>> = [
            {
                scheduledTime: {
                    startTimestamp: MoreThanOrEqual(ensuredSinceDateTime),
                    endTimestamp: LessThanOrEqual(ensuredUntilDateTime)
                },
                ...nativeScheduleDefaultOption
            },
            {
                scheduledBufferTime: {
                    startBufferTimestamp: MoreThanOrEqual(ensuredSinceDateTime),
                    endBufferTimestamp: LessThanOrEqual(ensuredUntilDateTime)
                },
                ...nativeScheduleDefaultOption
            }
        ];

        const syncNativeSchedule$ = defer(() => from(this.scheduleRepository.findBy(nativeScheduleConditionOptions)));

        return syncNativeSchedule$;
    }
}
