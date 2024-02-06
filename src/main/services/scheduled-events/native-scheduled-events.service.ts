import { Injectable } from '@nestjs/common';
import { Observable, defer, from } from 'rxjs';
import { FindOperator, FindOptionsOrder, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ScheduledEventsService } from '@core/interfaces/scheduled-events/scheduled-events.service.interface';
import { InviteeScheduledEvent } from '@core/interfaces/scheduled-events/invitee-scheduled-events.interface';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { ScheduledStatus } from '@interfaces/scheduled-events/scheduled-status.enum';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';

@Injectable()
export class NativeScheduledEventsService implements ScheduledEventsService {

    constructor(
        @InjectRepository(ScheduledEvent) private readonly scheduledEventRepository: Repository<ScheduledEvent>
    ) {}

    search(scheduleSearchOption: Partial<ScheduledEventSearchOption>): Observable<InviteeScheduledEvent[]> {

        const {
            eventUUID,
            since,
            until,
            page,
            take,
            status,
            statusGroup,
            teamId,
            orderScheduledTimeStartTimestamp
        } = scheduleSearchOption;

        const ensuredTake = take ? take : undefined;
        const skip = page && take ? page * take : 0;

        const _90daysAfter = new Date().getDate() + 90;
        const defaultUntilDateTime = new Date(new Date().setDate(_90daysAfter));
        const ensuredSinceDateTime = since ? new Date(since) : new Date();
        const ensuredUntilDateTime = until ? new Date(until) : defaultUntilDateTime;

        let statusCondition: FindOperator<ScheduledStatus>;

        if (statusGroup === 'upcoming') {
            statusCondition = In([ScheduledStatus.OPENED, ScheduledStatus.CONFIRMED, ScheduledStatus.REMINDED]);
        } else {
            statusCondition = In([ScheduledStatus.CANCELED, ScheduledStatus.COMPLETED]);
        }

        const nativeScheduleDefaultOption: FindOptionsWhere<ScheduledEvent> = {
            eventUUID,
            teamId,
            status: status || statusCondition
        };

        const nativeScheduleConditionOptions: Array<FindOptionsWhere<ScheduledEvent>> = [
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

        const patchedOrderSearchOption: FindOptionsOrder<ScheduledEvent> | undefined = orderScheduledTimeStartTimestamp
            ? {
                scheduledTime: {
                    startTimestamp: orderScheduledTimeStartTimestamp
                }
            } : undefined;

        const syncNativeSchedule$ = defer(() => from(this.scheduledEventRepository.find({
            where: nativeScheduleConditionOptions,
            order: patchedOrderSearchOption,
            take: ensuredTake,
            skip
        })));

        return syncNativeSchedule$;
    }
}
