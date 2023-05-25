import { Injectable } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { TemporaryUser } from '@entity/users/temporary-user.entity';
import { Verification } from '@entity/verifications/verification.entity';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { AppInjectCluster } from './app-inject-cluster.decorator';
import { RedisStores } from './redis-stores.enum';

@Injectable()
export class SyncdayRedisService {
    constructor(@AppInjectCluster() private readonly cluster: Cluster) {}

    async getTemporaryUser(email: string): Promise<TemporaryUser> {
        const temporaryUserKey = this.getTemporaryUserKey(email);
        const result = await this.cluster.get(temporaryUserKey);

        return result ? JSON.parse(result) : null;
    }

    async saveTemporaryUser(temporaryUser: TemporaryUser): Promise<boolean> {
        const temporaryUserKey = this.getTemporaryUserKey(temporaryUser.email);
        const result = await this.cluster.set(temporaryUserKey, JSON.stringify(temporaryUser));

        return result === 'OK';
    }

    async getWorkspaceStatus(workspace: string): Promise<boolean> {
        const workspaceAssignStatusKey = this.getWorkspaceAssignStatusKey(workspace);
        const workspaceAssignStatusJsonString = await this.cluster.get(workspaceAssignStatusKey);

        return workspaceAssignStatusJsonString
            ? (JSON.parse(workspaceAssignStatusJsonString) as boolean)
            : false;
    }

    async setWorkspaceStatus(workSpace: string): Promise<boolean> {
        const workspaceAssignStatusKey = this.getWorkspaceAssignStatusKey(workSpace);
        const result = await this.cluster.set(workspaceAssignStatusKey, String(true));

        return result === 'OK';
    }

    async deleteWorkspaceStatus(workSpace: string): Promise<boolean> {
        const workspaceAssignStatusKey = this.getWorkspaceAssignStatusKey(workSpace);
        const deletedCount = await this.cluster.del(workspaceAssignStatusKey);

        return deletedCount > 0;
    }

    async getEmailVerification(email: string): Promise<Verification | null> {
        const emailKey = this.getEmailVerificationKey(email);
        const actualVerificationCodeJsonString = await this.cluster.get(emailKey);

        return actualVerificationCodeJsonString
            ? (JSON.parse(actualVerificationCodeJsonString) as Verification)
            : null;
    }

    async getEmailVerificationStatus(email: string, uuid: string): Promise<boolean> {
        const emailVerificationStatusKey = this.getEmailVerificationStatusKey(email, uuid);
        const actualVerificationStatusJsonString = await this.cluster.get(
            emailVerificationStatusKey
        );

        return actualVerificationStatusJsonString
            ? (JSON.parse(actualVerificationStatusJsonString) as boolean)
            : false;
    }

    async setEmailVerificationStatus(
        email: string,
        uuid: string,
        statusValue = true
    ): Promise<boolean> {
        const emailVerificationStatusKey = this.getEmailVerificationStatusKey(email, uuid);
        const result = await this.cluster.set(emailVerificationStatusKey, String(statusValue));

        return result === 'OK';
    }

    async setAvailability(
        availabilityUUID: string,
        userUUID: string,
        availabilityBody: AvailabilityBody
    ): Promise<boolean> {
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

        const availabilityUserKey = this._getAvailabilityHashMapKey(userUUID);
        const updatedHashFields = await this.cluster.hset(
            availabilityUserKey,
            availabilityUUID,
            JSON.stringify(availabilityBody)
        );

        return updatedHashFields === 1;
    }

    async getAvailability(availabilityUUID: string, userUUID: string): Promise<AvailabilityBody> {
        const availabilityUserKey = this._getAvailabilityHashMapKey(userUUID);

        const availabilityBodyJsonString = await this.cluster.hget(
            availabilityUserKey,
            availabilityUUID
        );

        return availabilityBodyJsonString
            ? JSON.parse(availabilityBodyJsonString as unknown as string)
            : null;
    }

    async deleteAvailability(availabilityUUID: string, userUUID: string): Promise<boolean> {
        const availabilityUserKey = this._getAvailabilityHashMapKey(userUUID);
        const deleteCount = await this.cluster.hdel(availabilityUserKey, availabilityUUID);

        return deleteCount === 1;
    }

    async getAvailabilityBodyRecord(userUUID: string): Promise<Record<string, AvailabilityBody>> {
        const availabilityListKey = this._getAvailabilityHashMapKey(userUUID);
        const availabilityUUIDRecords = await this.cluster.hgetall(availabilityListKey);

        const parsedAvailabilityBodies =
            this.__parseHashmapRecords<AvailabilityBody>(availabilityUUIDRecords);

        return parsedAvailabilityBodies;
    }

    getTemporaryUserKey(email: string): RedisKey {
        return this.getRedisKey(RedisStores.TEMPORARY_USER, [email]);
    }

    getWorkspaceAssignStatusKey(workspace: string): RedisKey {
        return this.getRedisKey(RedisStores.WORKSPACES, [String(workspace)]);
    }

    getEmailVerificationKey(email: string): RedisKey {
        return this.getRedisKey(RedisStores.VERIFICATIONS_EMAIL, [String(email)]);
    }

    getEmailVerificationStatusKey(email: string, uuid: string): RedisKey {
        return this.getRedisKey(RedisStores.VERIFICATIONS_EMAIL, [String(email), uuid]);
    }

    getInviteeQuestionKey(eventDetailUUID: string): RedisKey {
        return this.getRedisKey(RedisStores.EVENT_DETAIL, [
            eventDetailUUID,
            RedisStores.INVITEE_QUESTION
        ]);
    }

    getRemindersKey(eventDetailUUID: string): RedisKey {
        return this.getRedisKey(RedisStores.EVENT_DETAIL, [eventDetailUUID, RedisStores.REMINDER]);
    }

    _getAvailabilityHashMapKey(userUUID: string): RedisKey {
        return this.getRedisKey(RedisStores.AVAILABILITY, [userUUID]);
    }

    __parseHashmapRecords<T>(hashmapRecords: Record<string, string>): Record<string, T> {
        const entries = Object.entries(hashmapRecords).reduce<Record<string, T>>(
            (acc, [key, value]) => ({
                ...acc,
                [key]: JSON.parse(value)
            }),
            {}
        );

        return entries;
    }

    private getRedisKey(store: RedisStores, value: string[]): string {
        return [store, ...value].join(':');
    }
}
