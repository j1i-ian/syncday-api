import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, from, map } from 'rxjs';
import { EntityManager, Repository } from 'typeorm';
import { TeamSettingSearchOption } from '@interfaces/teams/team-settings/team-setting-search-option.interface';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { AlreadyUsedInWorkspace } from '@app/exceptions/users/already-used-in-workspace.exception';

@Injectable()
export class TeamSettingService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @InjectRepository(TeamSetting)
        private readonly teamSettingRepository: Repository<TeamSetting>
    ) {}

    search(
        teamSettingSearchOption: TeamSettingSearchOption
    ): Observable<TeamSetting[]> {
        return from(this.teamSettingRepository.findBy(teamSettingSearchOption));
    }

    async fetchByTeamId(teamId: number): Promise<TeamSetting> {
        const loadedTeamSetting = await this.teamSettingRepository.findOneOrFail({
            where: {
                teamId
            }
        });

        if (loadedTeamSetting === null) {
            throw new NotFoundException('Team setting does not exist');
        }

        return loadedTeamSetting;
    }

    async fetchTeamWorkspaceStatus(workspace: string): Promise<boolean> {
        const workspaceStatus = await this.syncdayRedisService.getWorkspaceStatus(workspace);
        return workspaceStatus;
    }

    patch(teamId: number, teamSetting: Partial<TeamSetting>): Observable<boolean> {
        return from(
            this.teamSettingRepository.update(
                { teamId },
                teamSetting
            )
        ).pipe(
            map((updateResult) => !!(updateResult &&
                updateResult.affected &&
                updateResult.affected > 0))
        );
    }

    async updateTeamWorkspace(
        teamId: number,
        newWorkspace: string
    ): Promise<boolean> {
        return this._updateTeamWorkspace(
            this.teamSettingRepository.manager,
            teamId,
            newWorkspace
        );
    }

    async _updateTeamWorkspace(
        manager: EntityManager,
        teamId: number,
        newWorkspace: string
    ): Promise<boolean> {

        const _teamSettingRepository = manager.getRepository(TeamSetting);

        // for validation again
        const _workspaceUsageStatus = await this.syncdayRedisService.getWorkspaceStatus(
            newWorkspace
        );

        if (_workspaceUsageStatus === true) {
            throw new AlreadyUsedInWorkspace();
        }

        const loadedTeamSetting = await _teamSettingRepository.findOneByOrFail({
            teamId
        });
        const previousWorkspace = loadedTeamSetting.workspace;

        // TODO: it should be wrapped by rxjs finalized.
        await this.syncdayRedisService.deleteWorkspaceStatus(previousWorkspace);

        const workspaceStatus = await this.syncdayRedisService.setWorkspaceStatus(newWorkspace);

        await _teamSettingRepository.update({ teamId }, { workspace: newWorkspace });

        return workspaceStatus;
    }
}
