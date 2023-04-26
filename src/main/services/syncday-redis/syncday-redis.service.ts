import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import Redis, { Cluster, RedisKey } from 'ioredis';
import * as calculateSlot from 'cluster-key-slot';
import { UtilService } from '@services/util/util.service';
import { TemporaryUser } from '@entity/users/temporary-user.entity';
import { DatetimePreset } from '@entity/datetime-presets/datetime-preset.entity';
import { Verification } from '@entity/verifications/verification.entity';
import { InviteeQuestion } from '@entity/invitee-questions/invitee-question.entity';
import { Reminder } from '@entity/reminders/reminder.entity';
import { AppInjectCluster } from './app-inject-cluster.decorator';
import { RedisStores } from './redis-stores.enum';

interface RedisNode {
    node: Redis | null;
    slotStart: number | null;
    slotEnd: number | null;
    keys: RedisKey[];
    values?: string[];
}
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
        timePresetWithOverrides: Pick<DatetimePreset, 'timepreset' | 'overrides'>
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
    ): Promise<Pick<DatetimePreset, 'timepreset' | 'overrides'>> {
        const datetimePresetUserKey = this.getDatetimePresetHashMapKey(userUUID);

        const timePresetRangeJsonString = await this.cluster.hmget(
            datetimePresetUserKey,
            datetimePresetUUID
        );

        return timePresetRangeJsonString
            ? JSON.parse(timePresetRangeJsonString as unknown as string)
            : null;
    }

    async setInviteeQuestion(uuid: string, inviteeQuestions: InviteeQuestion[]): Promise<boolean> {
        const inviteeQuestionKey = this.getInviteeQuestionKey(uuid);
        const result = await this.cluster.set(inviteeQuestionKey, JSON.stringify(inviteeQuestions));

        return result === 'OK';
    }

    async getInviteeQuestion(uuid: string): Promise<InviteeQuestion[]> {
        const inviteeQuestionKey = this.getInviteeQuestionKey(uuid);
        const inviteeQuestions = await this.cluster.get(inviteeQuestionKey);

        return inviteeQuestions ? JSON.parse(inviteeQuestions) : null;
    }

    async setReminder(uuid: string, reminders: Reminder[]): Promise<boolean> {
        const reminderKey = this.getReminderKey(uuid);
        const result = await this.cluster.set(reminderKey, JSON.stringify(reminders));

        return result === 'OK';
    }

    async getReminder(uuid: string): Promise<Reminder[]> {
        const reminderKey = this.getReminderKey(uuid);
        const reminders = await this.cluster.get(reminderKey);

        return reminders ? JSON.parse(reminders) : null;
    }

    async getDatetimePresets(userUUID: string): Promise<Record<string, string>> {
        const datetimePresetListKey = this.getDatetimePresetHashMapKey(userUUID);
        const datetimePresetUUIDRecords = await this.cluster.hgetall(datetimePresetListKey);

        return datetimePresetUUIDRecords;
    }

    async multiSet(payloads: Array<{ key: RedisKey; value: string }>): Promise<void> {
        const keys = payloads.map((payload) => payload.key);
        const values = payloads.map((payload) => payload.value);
        const nodeWithKeys = await this._getMappedNodes(keys, values);
        const pipelineResult: Array<[error: Error | null, result: unknown]> = [];

        for (const nodeWithKey of nodeWithKeys) {
            const pipelineCommands = nodeWithKey.keys.map((key, index) => {
                if (nodeWithKey.values === undefined) {
                    throw new BadRequestException('set value is undefined');
                }
                const value = nodeWithKey.values[index];

                return ['set', key, value];
            });
            const _pipelineResult = await this.cluster.pipeline(pipelineCommands).exec();
            if (_pipelineResult === null) {
                throw new InternalServerErrorException('pipeline execution result is null');
            }
            pipelineResult.push(..._pipelineResult);
        }

        if (pipelineResult === null) {
            throw new InternalServerErrorException('pipeline execution result is null');
        }
        pipelineResult.map((_result) => {
            const redisPipelineError = _result[0];
            if (redisPipelineError !== null) {
                throw redisPipelineError;
            }
        });
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
        return this.getRedisKey(RedisStores.DATETIME_PRESET, [userUUID]);
    }

    getDatetimePresetHashMapDetailKey(userUUID: string, datetimePresetUUID: string): RedisKey {
        return this.getRedisKey(RedisStores.DATETIME_PRESET, [userUUID, datetimePresetUUID]);
    }

    getInviteeQuestionKey(uuid: string): RedisKey {
        return this.getRedisKey(RedisStores.INVITEE_QUESTION, [uuid]);
    }

    getReminderKey(uuid: string): RedisKey {
        return this.getRedisKey(RedisStores.REMINDER, [uuid]);
    }

    /**
     * @param values 해당 keys 배열에 대응하는 value들
     * redis key 들이 어떤 slot에 들어가는지 판단하고, 해당 slot이 속한 node 객체에 mapping 한다.
     */
    async _getMappedNodes(keys: RedisKey[], values?: string[]): Promise<RedisNode[]> {
        const masterNodes = this.cluster.nodes('master');
        const nodeSlots = await this.cluster.cluster('SLOTS');

        const nodeWithKeys = masterNodes.map((node) => {
            const nodeWithKey: RedisNode = {
                node: null,
                slotStart: null,
                slotEnd: null,
                keys: [],
                values: []
            };
            nodeWithKey.node = node;

            const slot = nodeSlots.find((_slot) => node.options.port === _slot[2][1]);
            if (slot === undefined) {
                throw new InternalServerErrorException('slot not found');
            }
            nodeWithKey.slotStart = slot[0];
            nodeWithKey.slotEnd = slot[1];

            return nodeWithKey;
        });

        for (const [index, key] of keys.entries()) {
            const fullKey = this.utilService.getFullRedisKey(key.toString());
            const assignedSlot = calculateSlot(fullKey);
            for (const nodeWithKey of nodeWithKeys) {
                if (nodeWithKey.slotStart === null || nodeWithKey.slotEnd === null) {
                    throw new InternalServerErrorException('invalid slot');
                }
                if (assignedSlot <= nodeWithKey.slotEnd && assignedSlot >= nodeWithKey.slotStart) {
                    nodeWithKey.keys.push(key);
                    if (values) {
                        nodeWithKey.values?.push(values[index]);
                    }
                }
            }
        }

        return nodeWithKeys;
    }

    async _multiGet(keys: RedisKey[]): Promise<Array<[error: Error | null, result: unknown]>> {
        const nodeWithKeys = await this._getMappedNodes(keys);
        const pipelineResult: Array<[error: Error | null, result: unknown]> = [];

        for (const nodeWithKey of nodeWithKeys) {
            const pipelineCommands = nodeWithKey.keys.map((key) => ['get', key]);
            const _pipelineResult = await this.cluster.pipeline(pipelineCommands).exec();
            if (_pipelineResult === null) {
                throw new InternalServerErrorException('pipeline execution result is null');
            }
            pipelineResult.push(..._pipelineResult);
        }

        // 조회 결과가 keys 매개변수의 순서와 동일하지 않기 때문에 정렬하여 반환한다.
        const flattenKeyArray = nodeWithKeys.flatMap((node) => node.keys);
        const orderedResult = keys.map((key) => {
            const index = flattenKeyArray.indexOf(key);
            const stringResult = pipelineResult[index];
            return stringResult;
        });

        return orderedResult;
    }

    private getRedisKey(store: RedisStores, value: string[]): string {
        return [store, ...value].join(':');
    }
}
