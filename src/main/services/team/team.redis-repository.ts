import { Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';

@Injectable()
export class TeamRedisRepository {

    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    async initializeMemberCount(
        teamUUID: string,
        initialTeamMemberCount = 1
    ): Promise<void> {

        const memberCountKey = this.syncdayRedisService.getMemberCountKey(teamUUID);

        await this.cluster.set(memberCountKey, initialTeamMemberCount);
    }

    async searchMemberCount(teamUUIDs: string[]): Promise<number[]> {
        const readPipeline = this.cluster.pipeline();

        teamUUIDs.forEach((teamUUID) => {
            const memberCountKey = this.syncdayRedisService.getMemberCountKey(teamUUID);
            readPipeline.get(memberCountKey);
        });

        const results = await readPipeline.exec() ?? [];

        return results
            .map(([err, _memberCount ]) => err ? 1 : +(_memberCount as string | number));
    }

    async getMemberCount(teamUUID: string): Promise<number> {
        const memberCountKey = this.syncdayRedisService.getMemberCountKey(teamUUID);
        const reuslt = await this.cluster.get(memberCountKey);

        return reuslt ? +reuslt : 1;
    }

    async incrementMemberCount(
        teamUUID: string,
        increment = 1
    ): Promise<number> {
        const memberCountKey = this.syncdayRedisService.getMemberCountKey(teamUUID);

        const result = await this.cluster.incrby(memberCountKey, String(increment));

        return result ? +result : 1;
    }

    async decrementMemberCount(
        teamUUID: string,
        decrement = 1
    ): Promise<number> {
        const memberCountKey = this.syncdayRedisService.getMemberCountKey(teamUUID);

        const result = await this.cluster.decrby(memberCountKey, String(decrement));

        return result ? +result : 1;
    }
}
