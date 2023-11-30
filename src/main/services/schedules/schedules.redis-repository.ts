import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable, from, map } from 'rxjs';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { ScheduleBody } from '@app/interfaces/schedules/schedule-body.interface';
import { CannotFindScheduleBody } from '@app/exceptions/schedules/cannot-find-schedule-body.exception';

@Injectable()
export class SchedulesRedisRepository {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

    getScheduleBody(scheduleUUID: string): Observable<ScheduleBody> {
        const scheduleBodyKey = this.syncdayRedisService._getScheduleBodyKey(scheduleUUID);

        return from(this.cluster.get(scheduleBodyKey))
            .pipe(
                map(
                    (scheduleBodyJson: string | null) => {
                        if (scheduleBodyJson) {
                            return JSON.parse(scheduleBodyJson) as ScheduleBody;
                        } else {
                            throw new CannotFindScheduleBody();
                        }
                    }
                )
            );
    }

    async set(
        scheduleUUID: string,
        scheduleBody: ScheduleBody
    ): Promise<boolean> {

        scheduleBody.inviteeAnswers = scheduleBody.inviteeAnswers;
        scheduleBody.scheduledNotificationInfo = scheduleBody.scheduledNotificationInfo;

        const scheduleBodyKey = this.syncdayRedisService._getScheduleBodyKey(scheduleUUID);
        const createdField = await this.cluster.set(
            scheduleBodyKey,
            JSON.stringify(scheduleBody)
        );

        return createdField === 'OK';
    }

    save(scheduleUUID: string, scheduleBody: ScheduleBody): Observable<ScheduleBody> {
        return from(this.set(scheduleUUID, scheduleBody))
            .pipe(
                map((createSuccess) => {
                    if (!createSuccess) {
                        throw new CannotFindScheduleBody();
                    }

                    return scheduleBody;
                })
            );
    }

    async removeSchedules(scheduleUUIDs: string[]): Promise<boolean> {
        const scheduleBodyKeys = scheduleUUIDs.map((scheduleUUID) =>
            this.syncdayRedisService._getScheduleBodyKey(scheduleUUID)
        );

        const deletedScheduledNode = await this.cluster.del(...scheduleBodyKeys);

        const deleteSuccess = deletedScheduledNode >= 0;

        return deleteSuccess;
    }

}
