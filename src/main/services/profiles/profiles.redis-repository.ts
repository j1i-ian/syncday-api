import { Inject, Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Observable, from, map, mergeMap, of, tap, toArray } from 'rxjs';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';

@Injectable()
export class ProfilesRedisRepository {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @AppInjectCluster() private readonly cluster: Cluster,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    async filterAlreadyInvited(teamId: number, emailOrPhoneBulk: string[]): Promise<string[]> {

        const checkPipeline = this.cluster.pipeline();

        emailOrPhoneBulk.forEach((emailOrPhone) => {

            const invitedNewMemberKey = this.syncdayRedisService.getInvitedNewMemberKey(emailOrPhone);

            checkPipeline.sismember(invitedNewMemberKey, teamId);
        });

        const pipelineResults = await checkPipeline.exec();

        const alreadyInvitedMembers = pipelineResults?.flatMap((_pipelineResult) => _pipelineResult[1] as number)
            .map((result, index) => result === 1 ? emailOrPhoneBulk[index] : null)
            .filter((_alreadyInvitedOrNull) => !!_alreadyInvitedOrNull) as string[];

        return alreadyInvitedMembers ?? [];
    }

    getInvitedTeamIds(emailOrPhone: string): Observable<number[]> {

        const invitedNewMemberKey = this.syncdayRedisService.getInvitedNewMemberKey(emailOrPhone);

        return from(this.cluster.smembers(invitedNewMemberKey))
            .pipe(
                mergeMap((teamIdStringArray) =>
                    from(teamIdStringArray)
                        .pipe(
                            map((teamIdString) => +teamIdString),
                            toArray()
                        )
                )
            );
    }

    setInvitedNewTeamMembers(
        createdTeamId: number,
        invitedNewMembers: InvitedNewTeamMember[]
    ): Observable<boolean> {

        return of(this.cluster.pipeline())
            .pipe(
                mergeMap((setAddPipeline) =>
                    from(invitedNewMembers)
                        .pipe(
                            map((_invitedNewMember) => (_invitedNewMember.email || _invitedNewMember.phone) as string),
                            map((_invitedNewMemberKey) => this.syncdayRedisService.getInvitedNewMemberKey(_invitedNewMemberKey)),
                            tap((_invitedNewMemberRedisKey) => setAddPipeline.sadd(_invitedNewMemberRedisKey, createdTeamId)),
                            toArray(),
                            mergeMap(() => from(setAddPipeline.exec()))
                        )
                ),
                map((pipelineResults) => pipelineResults?.filter((_pipelineResult) => _pipelineResult[0]) || []),
                map((filteredErrors) => {
                    if (filteredErrors.length > 0) {
                        this.logger.error({
                            message: 'Error while new member invitation saving',
                            filteredErrors
                        });
                    }
                }),
                map(() => true)
            );
    }

    deleteTeamInvitations(emailOrPhone: string): Observable<boolean> {
        const memberKey = this.syncdayRedisService.getInvitedNewMemberKey(emailOrPhone);

        return from(this.cluster.del(memberKey))
            .pipe(
                map((deletedCount) => deletedCount > 0)
            );
    }
}
