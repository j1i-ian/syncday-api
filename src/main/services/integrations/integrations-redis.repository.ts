import { Injectable } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { RedisStores } from '@services/syncday-redis/redis-stores.enum';
import { UtilService } from '@services/util/util.service';
import { GoogleCalendarDetail } from '@app/interfaces/integrations/google/google-calendar-detail.interface';

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

    async deleteGoogleCalendarSubscriptionStatus(googleChannelId: string): Promise<boolean> {
        const calendarSubscriptionStatusKey = this.getGoogleCalendarSubscriptionStatusKey(googleChannelId);
        const result = await this.cluster.del(calendarSubscriptionStatusKey);

        return result === 1;
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
            String(googleChannelId)
        ]);
    }
}
