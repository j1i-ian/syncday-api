import { Injectable } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { InjectCluster } from '@liaoliaots/nestjs-redis';
import { RedisStores } from './redis-stores.enum';

@Injectable()
export class SyncdayRedisService {
    constructor(
        /**
         * ignore typescript error of library
         */
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        @InjectCluster() private readonly cluster: Cluster
    ) {}

    getEmailVerificationKey(userUid: number): RedisKey {
        return this.getRedisKey(RedisStores.VERIFICATIONS_EMAIL, [String(userUid)]);
    }

    getRedisKey(store: RedisStores, value: string[]): string {
        return [store, ...value].join(':');
    }
}
