import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable, from, map } from 'rxjs';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { ScheduledEventBody } from '@app/interfaces/scheduled-events/schedule-body.interface';
import { CannotFindScheduledEventBody } from '@app/exceptions/scheduled-events/cannot-find-schedule-body.exception';

@Injectable()
export class ScheduledEventsRedisRepository {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

    getScheduledEventBody(scheduledEventUUID: string): Observable<ScheduledEventBody> {
        const scheduledEventBodyKey = this.syncdayRedisService._getScheduledEventBodyKey(scheduledEventUUID);

        return from(this.cluster.get(scheduledEventBodyKey))
            .pipe(
                map(
                    (scheduledEventBodyJson: string | null) => {
                        if (scheduledEventBodyJson) {
                            return JSON.parse(scheduledEventBodyJson) as ScheduledEventBody;
                        } else {
                            throw new CannotFindScheduledEventBody();
                        }
                    }
                )
            );
    }

    async set(
        scheduleUUID: string,
        scheduledEventBody: ScheduledEventBody
    ): Promise<boolean> {

        scheduledEventBody.inviteeAnswers = scheduledEventBody.inviteeAnswers;
        scheduledEventBody.scheduledNotificationInfo = scheduledEventBody.scheduledNotificationInfo;

        const scheduledEventBodyKey = this.syncdayRedisService._getScheduledEventBodyKey(scheduleUUID);
        const createdField = await this.cluster.set(
            scheduledEventBodyKey,
            JSON.stringify(scheduledEventBody)
        );

        return createdField === 'OK';
    }

    save(scheduleUUID: string, scheduledEventBody: ScheduledEventBody): Observable<ScheduledEventBody> {
        return from(this.set(scheduleUUID, scheduledEventBody))
            .pipe(
                map((createSuccess) => {
                    if (!createSuccess) {
                        throw new CannotFindScheduledEventBody();
                    }

                    return scheduledEventBody;
                })
            );
    }

    async removeSchedules(scheduleUUIDs: string[]): Promise<boolean> {
        const scheduledEventBodyKeys = scheduleUUIDs.map((scheduledEventUUID) =>
            this.syncdayRedisService._getScheduledEventBodyKey(scheduledEventUUID)
        );

        const deletedScheduledNode = await this.cluster.del(...scheduledEventBodyKeys);

        const deleteSuccess = deletedScheduledNode >= 0;

        return deleteSuccess;
    }

}
