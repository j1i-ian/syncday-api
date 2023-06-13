import { Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { Observable, from, mergeMap } from 'rxjs';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { CannotFindAvailabilityBody } from '@app/exceptions/availability/cannot-find-availability-body.exception';
import { AvailabilityBodySaveFail } from '@app/exceptions/availability/availability-body-save-fail.exception';

@Injectable()
export class AvailabilityRedisRepository {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    async getAvailabilityBodyRecord(userUUID: string): Promise<Record<string, AvailabilityBody>> {
        const availabilityListKey = this.syncdayRedisService._getAvailabilityHashMapKey(userUUID);
        const availabilityUUIDRecords = await this.cluster.hgetall(availabilityListKey);

        const parsedAvailabilityBodies =
            this.syncdayRedisService.__parseHashmapRecords<AvailabilityBody>(
                availabilityUUIDRecords
            );

        return parsedAvailabilityBodies;
    }

    async getAvailabilityBody(
        availabilityUUID: string,
        userUUID: string
    ): Promise<AvailabilityBody> {
        const availabilityUserKey = this.syncdayRedisService._getAvailabilityHashMapKey(userUUID);

        const availabilityBodyJsonString = await this.cluster.hget(
            availabilityUserKey,
            availabilityUUID
        );

        if (!availabilityBodyJsonString) {
            throw new CannotFindAvailabilityBody();
        }
        const availabilityBody =
            (JSON.parse(availabilityBodyJsonString as unknown as string) as AvailabilityBody) ??
            null;

        return availabilityBody;
    }

    async save(
        availabilityUUID: string,
        userUUID: string,
        availabilityBody: AvailabilityBody
    ): Promise<AvailabilityBody> {
        const createdHashFieldCount = await this.set(availabilityUUID, userUUID, availabilityBody);

        if (createdHashFieldCount !== 1) {
            throw new AvailabilityBodySaveFail();
        } else {
            return availabilityBody;
        }
    }

    async update(
        availabilityUUID: string,
        userUUID: string,
        availabilityBody: AvailabilityBody
    ): Promise<boolean> {
        const createdHashFieldCount = await this.set(availabilityUUID, userUUID, availabilityBody);

        if (createdHashFieldCount !== 0) {
            throw new AvailabilityBodySaveFail();
        } else {
            return true;
        }
    }

    async set(
        availabilityUUID: string,
        userUUID: string,
        availabilityBody: AvailabilityBody
    ): Promise<number> {
        availabilityBody.availableTimes = availabilityBody.availableTimes.sort(
            (availableTimeA, availableTimeB) => availableTimeA.day - availableTimeB.day
        );

        // ascending
        availabilityBody.overrides = availabilityBody.overrides
            .filter((override) => new Date(override.targetDate).getTime() > Date.now())
            .sort(
                (overrideA, overrideB) =>
                    new Date(overrideB.targetDate).getTime() -
                    new Date(overrideA.targetDate).getTime()
            );

        const availabilityUserKey = this.syncdayRedisService._getAvailabilityHashMapKey(userUUID);
        const createdHashFields = await this.cluster.hset(
            availabilityUserKey,
            availabilityUUID,
            JSON.stringify(availabilityBody)
        );

        return createdHashFields;
    }

    async updateAll(userUUID: string, updateAvailabilityBody: AvailabilityBody): Promise<boolean> {
        const allAvailabilityRecordOfUser = await this.getAvailabilityBodyRecord(userUUID);

        // sort
        updateAvailabilityBody.availableTimes = updateAvailabilityBody.availableTimes.sort(
            (availableTimeA, availableTimeB) => availableTimeA.day - availableTimeB.day
        );

        // ascending
        updateAvailabilityBody.overrides = updateAvailabilityBody.overrides
            .filter((override) => new Date(override.targetDate).getTime() > Date.now())
            .sort(
                (overrideA, overrideB) =>
                    new Date(overrideB.targetDate).getTime() -
                    new Date(overrideA.targetDate).getTime()
            );

        const updatedAvailabilityMap: Map<string, string> = Object.keys(
            allAvailabilityRecordOfUser
        ).reduce((_availabilityBodyMap, availabilityUUIDKey) => {
            _availabilityBodyMap.set(availabilityUUIDKey, JSON.stringify(updateAvailabilityBody));
            return _availabilityBodyMap;
        }, new Map());

        const availabilityUserKey = this.syncdayRedisService._getAvailabilityHashMapKey(userUUID);

        /**
         * all fields should be updated, so the created item should not exist
         */
        const createdFieldsCount = await this.cluster.hset(
            availabilityUserKey,
            updatedAvailabilityMap
        );

        if (createdFieldsCount !== 0) {
            throw new AvailabilityBodySaveFail();
        } else {
            return true;
        }
    }

    async deleteAvailabilityBody(availabilityUUID: string, userUUID: string): Promise<boolean> {
        const availabilityUserKey = this.syncdayRedisService._getAvailabilityHashMapKey(userUUID);
        const deleteCount = await this.cluster.hdel(availabilityUserKey, availabilityUUID);

        return deleteCount === 1;
    }

    async deleteAll(userUUID: string, availabilityUUIDs: string[]): Promise<boolean>{
        const availabilityUserKey = this.syncdayRedisService._getAvailabilityHashMapKey(userUUID);
        const deleteCount = await this.cluster.hdel(availabilityUserKey, ...availabilityUUIDs);

        const deleteSuccess = deleteCount >= 1;
        return deleteSuccess;
    }

    clone(
        userUUID: string,
        sourceAvailabilityUUID: string,
        newAvailabilityUUID: string
    ): Observable<AvailabilityBody> {
        return from(this.getAvailabilityBody(sourceAvailabilityUUID, userUUID)).pipe(
            mergeMap((availabilityBody) =>
                this.save(userUUID, newAvailabilityUUID, availabilityBody)
            )
        );
    }
}
