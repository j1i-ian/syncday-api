import { Injectable } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { GoogleCalendarDetail } from '@core/interfaces/integrations/google/google-calendar-detail.interface';
import { RedisStores } from '@core/interfaces/syncday-redis/redis-stores.enum';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { UtilService } from '@services/util/util.service';

@Injectable()
export class IntegrationsRedisRepository {
    constructor(
        private readonly utilService: UtilService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    async getGoogleCalendarSubscriptionStatus(googleChannelId: string): Promise<boolean> {
        const calendarSubscriptionStatusKey = this.getGoogleCalendarSubscriptionStatusKey(googleChannelId);
        const calendarSubscriptionStatusJsonString = await this.cluster.get(calendarSubscriptionStatusKey);

        return calendarSubscriptionStatusJsonString
            ? (JSON.parse(calendarSubscriptionStatusJsonString) as boolean)
            : false;
    }

    async setGoogleCalendarSubscriptionStatus(googleChannelId: string): Promise<boolean> {
        const calendarSubscriptionStatusKey = this.getGoogleCalendarSubscriptionStatusKey(googleChannelId);
        const result = await this.cluster.set(calendarSubscriptionStatusKey, String(true));

        return result === 'OK';
    }

    /**
     * TODO: In most deletion scenarios, there is no need to use a pipeline for delete.
     * However, when dealing with an ID array that doesn't exist in Redis, the direct delete method doesn't work.
     */
    async deleteGoogleCalendarSubscriptionsStatus(googleChannelIds: string[]): Promise<boolean> {
        const deletePipeline = this.cluster.pipeline();

        googleChannelIds.forEach((googleChannelId) => {
            const _redisPipelineKey = this.getGoogleCalendarSubscriptionStatusKey(googleChannelId);
            deletePipeline.del(_redisPipelineKey);

        });

        await deletePipeline.exec();

        return true;
    }

    async deleteGoogleCalendarSubscriptionStatus(googleChannelId: string): Promise<boolean> {
        const calendarSubscriptionStatusKey = this.getGoogleCalendarSubscriptionStatusKey(googleChannelId);
        const result = await this.cluster.del(calendarSubscriptionStatusKey);

        return result === 1;
    }

    async getGoogleCalendarsDetailAll(googleIntegrationUUID: string): Promise<Record<string, GoogleCalendarDetail>> {

        const googleCalendarIntegrationHashMapKey = this.getGoogleCalendarIntegrationKey(googleIntegrationUUID);

        const googleCalendarsDetailAllRecords = await this.cluster.hgetall(
            googleCalendarIntegrationHashMapKey
        );

        const parsedGoogleCalendarsDetailAllRecords =
            this.__parseHashmapRecords<GoogleCalendarDetail>(
                googleCalendarsDetailAllRecords
            );

        return parsedGoogleCalendarsDetailAllRecords;
    }

    async getGoogleCalendarDetail(
        googleIntegrationUUID: string,
        googleCalendarIntegrationUUID: string
    ): Promise<GoogleCalendarDetail | null> {

        const googleCalendarIntegrationHashMapKey = this.getGoogleCalendarIntegrationKey(googleIntegrationUUID);

        const googleCalendarDetailJson = await this.cluster.hget(
            googleCalendarIntegrationHashMapKey,
            googleCalendarIntegrationUUID
        );

        return googleCalendarDetailJson ?
            JSON.parse(googleCalendarDetailJson) as GoogleCalendarDetail :
            null;
    }

    async setGoogleCalendarDetail(
        googleIntegrationUUID: string,
        googleCalendarIntegrationUUID: string,
        googleCalendarDetail: GoogleCalendarDetail
    ): Promise<number> {

        const googleCalendarIntegrationHashMapKey = this.getGoogleCalendarIntegrationKey(googleIntegrationUUID);

        const createdHashFields = await this.cluster.hset(
            googleCalendarIntegrationHashMapKey,
            googleCalendarIntegrationUUID,
            JSON.stringify(googleCalendarDetail)
        );

        return createdHashFields;
    }

    async deleteGoogleCalendarDetail(
        googleIntegrationUUID: string,
        googleCalendarIntegrationUUID: string
    ): Promise<boolean> {

        const googleCalendarIntegrationHashMapKey = this.getGoogleCalendarIntegrationKey(googleIntegrationUUID);

        await this.cluster.hdel(
            googleCalendarIntegrationHashMapKey,
            googleCalendarIntegrationUUID
        );

        return true;
    }

    async deleteGoogleCalendarDetails(
        googleIntegrationUUID: string
    ): Promise<boolean> {

        const googleCalendarIntegrationHashMapKey = this.getGoogleCalendarIntegrationKey(googleIntegrationUUID);

        await this.cluster.del(googleCalendarIntegrationHashMapKey);

        return true;
    }

    getGoogleIntegrationKey(userUUID: string): RedisKey {
        return this.utilService.getRedisKey(RedisStores.USERS, [userUUID, RedisStores.GOOGLE_INTEGRATIONS]);
    }

    getGoogleCalendarIntegrationKey(googleIntegrationUUID: string): RedisKey {
        return this.utilService.getRedisKey(RedisStores.GOOGLE_INTEGRATIONS, [
            RedisStores.GOOGLE_INTEGRATIONS,
            googleIntegrationUUID,
            RedisStores.GOOGLE_CALENDARS
        ]);
    }

    getGoogleCalendarSubscriptionStatusKey(googleChannelId: string): RedisKey {
        return this.utilService.getRedisKey(RedisStores.CALENDAR_SUBSCRIPTION, [
            googleChannelId
        ]);
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
}
