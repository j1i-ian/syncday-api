import { Inject, Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { Team } from '@entity/teams/team.entity';

type TeamKeyString = `${string | Team['id']}:${Team['uuid']}`;

@Injectable()
export class ProfilesRedisRepository {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @AppInjectCluster() private readonly cluster: Cluster,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    async filterAlreadyInvited(
        teamId: number,
        teamUUID: string,
        emailOrPhoneBulk: string[]
    ): Promise<string[]> {

        const checkPipeline = this.cluster.pipeline();

        const teamKey = `${teamId}:${teamUUID}` as TeamKeyString;

        emailOrPhoneBulk.forEach((emailOrPhone) => {

            const invitedNewMemberKey = this.syncdayRedisService.getInvitedNewMemberKey(emailOrPhone);

            checkPipeline.sismember(invitedNewMemberKey, teamKey);
        });

        const pipelineResults = await checkPipeline.exec();

        const alreadyInvitedMembers = pipelineResults?.flatMap((_pipelineResult) => _pipelineResult[1] as number)
            .map((setIsMemberResult, index) => setIsMemberResult === 1 ? emailOrPhoneBulk[index] : null)
            .filter((_alreadyInvitedOrNull) => !!_alreadyInvitedOrNull) as string[];

        return alreadyInvitedMembers ?? [];
    }

    async getTeamInvitations(emailOrPhone: string): Promise<Array<Pick<Team, 'id' | 'uuid'>>> {

        const invitedNewMemberKey = this.syncdayRedisService.getInvitedNewMemberKey(emailOrPhone);

        const teamKeyStringArray = await this.cluster.smembers(invitedNewMemberKey) as TeamKeyString[];

        return teamKeyStringArray.map((_teamIdAndUUIDString) => {
            const [ teamId, teamUUID ] = _teamIdAndUUIDString.split(':');

            return {
                id: +teamId,
                uuid: teamUUID
            };
        });
    }

    async getAllTeamInvitations(teamUUID: string): Promise<string[]> {

        const teamInvitationsKey = this.syncdayRedisService.getTeamInvitationsKey(teamUUID);

        const emailOrPhoneBulk = await this.cluster.smembers(teamInvitationsKey);

        return emailOrPhoneBulk;
    }

    async setTeamInvitations(
        teamId: number,
        teamUUID: string,
        invitedNewMembers: InvitedNewTeamMember[]
    ): Promise<boolean> {

        const setAddPipeline = this.cluster.pipeline();

        invitedNewMembers.forEach((_invitedNewMember) => {

            const _invitedNewMemberKey = (_invitedNewMember.email || _invitedNewMember.phone) as string;

            const _invitedNewMemberRedisKey = this.syncdayRedisService.getInvitedNewMemberKey(_invitedNewMemberKey);
            const _teamInvitationKey = this.syncdayRedisService.getTeamInvitationsKey(teamUUID);

            const teamKeyString = `${teamId}:${teamUUID}` as TeamKeyString;

            setAddPipeline.sadd(_invitedNewMemberRedisKey, teamKeyString);
            setAddPipeline.sadd(_teamInvitationKey, _invitedNewMemberKey);
        });

        const pipelineResults = await setAddPipeline.exec();

        const filteredErrors = pipelineResults?.filter((_pipelineResult) => _pipelineResult[0]) || [];

        const hasError = filteredErrors.length > 0;
        const success = !hasError;

        if (hasError) {
            this.logger.error({
                message: 'Error while new member invitation saving',
                filteredErrors
            });
        }

        return success;
    }

    async deleteTeamInvitations(
        teamId: number,
        teamUUID: string,
        emailOrPhone: string
    ): Promise<boolean> {
        const memberKey = this.syncdayRedisService.getInvitedNewMemberKey(emailOrPhone);
        const teamInvitationsKey = this.syncdayRedisService.getTeamInvitationsKey(teamUUID);

        const deletePipeline = this.cluster.pipeline();

        const teamKeyString = `${teamId}:${teamUUID}` as TeamKeyString;

        deletePipeline.srem(memberKey, teamKeyString);
        deletePipeline.srem(teamInvitationsKey, emailOrPhone);

        const pipelineResults = await deletePipeline.exec();

        const filteredErrors = pipelineResults?.filter((_pipelineResult) => _pipelineResult[0]) || [];

        const hasError = filteredErrors.length > 0;
        const success = !hasError;

        if (hasError) {
            this.logger.error({
                message: 'Error while new member invitation saving',
                filteredErrors
            });
        }

        return success;
    }
}
