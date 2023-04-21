import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { TemporaryUser } from '@entity/users/temporary-user.entity';
import { DatetimePreset } from '@entity/datetime-presets/datetime-preset.entity';
import { Verification } from '../../../@core/core/entities/verifications/verification.entity';
import { InviteeQuestion } from '../../../@core/core/entities/invitee-questions/invitee-question.entity';
import { Reminder } from '../../../@core/core/entities/reminders/reminder.entity';
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

    async setDatetimePreset(
        uuid: string,
        timePresetRangeInformation: Pick<DatetimePreset, 'timepreset' | 'overrides'>
    ): Promise<boolean> {
        const datetimePresetKey = this.getDatetimePresetKey(uuid);
        const result = await this.cluster.set(
            datetimePresetKey,
            JSON.stringify(timePresetRangeInformation)
        );

        return result === 'OK';
    }

    async getDatetimePreset(
        uuid: string
    ): Promise<Pick<DatetimePreset, 'timepreset' | 'overrides'>> {
        const datetimePresetKey = this.getDatetimePresetKey(uuid);

        const timePresetRange = await this.cluster.get(datetimePresetKey);

        return timePresetRange ? JSON.parse(timePresetRange) : null;
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

    async getDatetimePresets(
        uuids: string[]
    ): Promise<Array<Pick<DatetimePreset, 'timepreset' | 'overrides'> | null>> {
        const datetimePresetKeys = uuids.map((uuid) => this.getDatetimePresetKey(uuid));
        const pipelineCommands = datetimePresetKeys.map((datetimePresetKey) => [
            'get',
            datetimePresetKey
        ]);

        const timepresetRanges = await this.cluster.pipeline(pipelineCommands).exec();
        if (timepresetRanges === null) {
            throw new InternalServerErrorException('pipeline execution result is null');
        }

        const parsedTimepresetRanges = timepresetRanges.map((timepresetRange) => {
            const redisPipelineError = timepresetRange[0];
            if (redisPipelineError !== null) {
                throw redisPipelineError;
            }

            return timepresetRange ? JSON.parse(timepresetRange[1] as string) : null;
        });

        return parsedTimepresetRanges;
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

    getDatetimePresetKey(uuid: string): RedisKey {
        return this.getRedisKey(RedisStores.DATETIME_PRESET, [uuid]);
    }

    getInviteeQuestionKey(uuid: string): RedisKey {
        return this.getRedisKey(RedisStores.INVITEE_QUESTION, [uuid]);
    }

    getReminderKey(uuid: string): RedisKey {
        return this.getRedisKey(RedisStores.REMINDER, [uuid]);
    }

    private getRedisKey(store: RedisStores, value: string[]): string {
        return [store, ...value].join(':');
    }
}
