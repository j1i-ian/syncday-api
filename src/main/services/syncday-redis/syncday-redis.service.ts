import { Injectable } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { Availability } from '@core/entities/availability/availability.entity';
import { UtilService } from '@services/util/util.service';
import { TemporaryUser } from '@entity/users/temporary-user.entity';
import { Verification } from '@entity/verifications/verification.entity';
import { AppInjectCluster } from './app-inject-cluster.decorator';
import { RedisStores } from './redis-stores.enum';

@Injectable()
export class SyncdayRedisService {
    constructor(
        @AppInjectCluster() private readonly cluster: Cluster,
        private readonly utilService: UtilService
    ) {}

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

    async setDatetimePreset(
        userUUID: string,
        datetimePresetUUID: string,
        timePresetWithOverrides: Pick<Availability, 'availableTimes' | 'overrides'>
    ): Promise<boolean> {
        const datetimePresetUserKey = this.getDatetimePresetHashMapKey(userUUID);
        const result = await this.cluster.hmset(
            datetimePresetUserKey,
            datetimePresetUUID,
            JSON.stringify(timePresetWithOverrides)
        );

        return result === 'OK';
    }

    async getDatetimePreset(
        userUUID: string,
        datetimePresetUUID: string
    ): Promise<Pick<Availability, 'availableTimes' | 'overrides'>> {
        const datetimePresetUserKey = this.getDatetimePresetHashMapKey(userUUID);

        const timePresetRangeJsonString = await this.cluster.hmget(
            datetimePresetUserKey,
            datetimePresetUUID
        );

        return timePresetRangeJsonString
            ? JSON.parse(timePresetRangeJsonString as unknown as string)
            : null;
    }

    async getDatetimePresets(userUUID: string): Promise<Record<string, string>> {
        const datetimePresetListKey = this.getDatetimePresetHashMapKey(userUUID);
        const datetimePresetUUIDRecords = await this.cluster.hgetall(datetimePresetListKey);

        return datetimePresetUUIDRecords;
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

    getDatetimePresetHashMapKey(userUUID: string): RedisKey {
        return this.getRedisKey(RedisStores.AVAILABILITY, [userUUID]);
    }

    private getRedisKey(store: RedisStores, value: string[]): string {
        return [store, ...value].join(':');
    }
}
