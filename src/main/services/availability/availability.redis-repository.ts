import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { Observable, from, mergeMap } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
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

    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

    async getAvailabilityBodyRecord(teamUUID: string): Promise<Record<string, AvailabilityBody>> {
        const availabilityHashmapKey = this.syncdayRedisService._getAvailabilityHashMapKey(teamUUID);
        const availabilityUUIDRecords = await this.cluster.hgetall(availabilityHashmapKey);

        const parsedAvailabilityBodies =
            this.syncdayRedisService.__parseHashmapRecords<AvailabilityBody>(
                availabilityUUIDRecords
            );

        return parsedAvailabilityBodies;
    }

    async getAvailabilityBody(
        teamUUID: string,
        profileId: number,
        availabilityUUID: string
    ): Promise<AvailabilityBody> {
        const availabilityTeamKey = this.syncdayRedisService._getAvailabilityHashMapKey(teamUUID);

        const availabilityBodyKey = [
            profileId,
            availabilityUUID
        ].join(':');

        const availabilityBodyJsonString = await this.cluster.hget(
            availabilityTeamKey,
            availabilityBodyKey
        );

        if (!availabilityBodyJsonString) {
            this.logger.error({
                message: 'CannotFindAvailabilityBody',
                profileId,
                availabilityUUID,
                teamUUID,
                availabilityBodyKey
            });

            throw new CannotFindAvailabilityBody();
        }

        const availabilityBody =
            (JSON.parse(availabilityBodyJsonString as unknown as string) as AvailabilityBody) ??
            null;

        return availabilityBody;
    }

    async save(
        teamUUID: string,
        profileId: number,
        availabilityUUID: string,
        availabilityBody: AvailabilityBody
    ): Promise<AvailabilityBody> {

        const createdHashFieldCount = await this.set(
            teamUUID,
            profileId,
            availabilityUUID,
            availabilityBody
        );

        if (createdHashFieldCount !== 1) {
            throw new AvailabilityBodySaveFail();
        } else {
            return availabilityBody;
        }
    }

    async update(
        teamUUID: string,
        profileId: number,
        availabilityUUID: string,
        availabilityBody: AvailabilityBody
    ): Promise<boolean> {

        const createdHashFieldCount = await this.set(
            teamUUID,
            profileId,
            availabilityUUID,
            availabilityBody
        );

        if (createdHashFieldCount !== 0) {
            throw new AvailabilityBodySaveFail();
        } else {
            return true;
        }
    }

    async set(
        teamUUID: string,
        profileId: number,
        availabilityUUID: string,
        availabilityBody: AvailabilityBody
    ): Promise<number> {
        availabilityBody.availableTimes = availabilityBody.availableTimes.sort(
            (availableTimeA, availableTimeB) => availableTimeA.day - availableTimeB.day
        );

        // Get today's date based on UTC
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // ascending
        availabilityBody.overrides = availabilityBody.overrides
            .filter((override) => new Date(override.targetDate).getTime() > yesterday.getTime())
            .sort(
                (overrideA, overrideB) =>
                    new Date(overrideB.targetDate).getTime() -
                    new Date(overrideA.targetDate).getTime()
            );

        const availabilityBodyKey = [
            profileId,
            availabilityUUID
        ].join(':');

        const availabilityUserKey = this.syncdayRedisService._getAvailabilityHashMapKey(teamUUID);
        const createdHashFields = await this.cluster.hset(
            availabilityUserKey,
            availabilityBodyKey,
            JSON.stringify(availabilityBody)
        );

        return createdHashFields;
    }

    async updateAll(
        teamUUID: string,
        profileId: number,
        updateAvailabilityBody: Partial<AvailabilityBody>
    ): Promise<boolean> {
        const allAvailabilityRecordOfTeam = await this.getAvailabilityBodyRecord(teamUUID);

        let {
            availableTimes: updatedAvailableTimes,
            overrides: updatedOverrides
        } = updateAvailabilityBody;

        if (updatedAvailableTimes) {
            updatedAvailableTimes = updatedAvailableTimes.sort(
                (availableTimeA, availableTimeB) => availableTimeA.day - availableTimeB.day
            );
        }

        if (updatedOverrides) {
            updatedOverrides = updatedOverrides
                .filter((override) => new Date(override.targetDate).getTime() > Date.now())
                .sort(
                    (overrideA, overrideB) =>
                        new Date(overrideB.targetDate).getTime() -
                        new Date(overrideA.targetDate).getTime()
                );
        }

        const updatedAvailabilityMap: Map<string, string> = Object.keys(
            allAvailabilityRecordOfTeam
        ).filter((_availabilityUUIDKey) => _availabilityUUIDKey.includes(String(profileId)))
            .reduce((_availabilityBodyMap, availabilityUUIDKey) => {

                const previousAvailabilityBody = allAvailabilityRecordOfTeam[availabilityUUIDKey];
                const updatedAvailabilityBody = {
                    availableTimes: updatedAvailableTimes || previousAvailabilityBody.availableTimes,
                    overrides: updatedOverrides || previousAvailabilityBody.availableTimes
                } as AvailabilityBody;

                _availabilityBodyMap.set(availabilityUUIDKey, JSON.stringify(updatedAvailabilityBody));

                return _availabilityBodyMap;
            }, new Map());

        const availabilityUserKey = this.syncdayRedisService._getAvailabilityHashMapKey(teamUUID);

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

    async deleteAvailabilityBody(
        teamUUID: string,
        profileId: number,
        availabilityUUID: string
    ): Promise<boolean> {
        const availabilityBodyKey = [
            profileId,
            availabilityUUID
        ].join(':');

        const availabilityTeamKey = this.syncdayRedisService._getAvailabilityHashMapKey(teamUUID);
        const deleteCount = await this.cluster.hdel(availabilityTeamKey, availabilityBodyKey);

        return deleteCount === 1;
    }

    async deleteAll(teamUUID: string, availabilityUUIDs?: string[]): Promise<boolean>{
        const availabilityHashmapKey = this.syncdayRedisService._getAvailabilityHashMapKey(teamUUID);

        let deleteCount: number;
        if (availabilityUUIDs) {
            deleteCount = await this.cluster.hdel(availabilityHashmapKey, ...availabilityUUIDs);

        } else {
            deleteCount = await this.cluster.del(availabilityHashmapKey);
        }

        const deleteSuccess = deleteCount >= 1;
        return deleteSuccess;
    }

    clone(
        teamUUID: string,
        profileId: number,
        sourceAvailabilityUUID: string,
        newAvailabilityUUID: string
    ): Observable<AvailabilityBody> {
        return from(
            this.getAvailabilityBody(teamUUID, profileId, sourceAvailabilityUUID)
        ).pipe(
            mergeMap((availabilityBody) =>
                this.save(teamUUID, profileId, newAvailabilityUUID, availabilityBody)
            )
        );
    }
}
