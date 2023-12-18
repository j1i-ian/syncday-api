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

    async _create(
        manager: EntityManager,
        newTeamSetting: Partial<TeamSetting>
    ): Promise<TeamSetting> {

        const teamSettingRepository = manager.getRepository(TeamSetting);

        const createdTeamSetting = teamSettingRepository.create(newTeamSetting);

        const savedTeamSetting = await teamSettingRepository.save(createdTeamSetting);

        const newWorkspace = savedTeamSetting.workspace;

        await this._updateTeamWorkspaceRecord(
            null,
            newWorkspace
        );

        await teamSettingRepository.update({
            teamId: savedTeamSetting.teamId
        }, {
            workspace: newWorkspace
        });

        return savedTeamSetting;
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
        const teamSetting = await this.teamSettingRepository.findOneByOrFail({
            teamId
        });

        const previousWorkspace = teamSetting.workspace;

        return this._updateTeamWorkspace(
            this.teamSettingRepository.manager,
            teamId,
            previousWorkspace,
            newWorkspace
        );
    }

    async _updateTeamWorkspace(
        manager: EntityManager,
        teamId: number,
        previousWorkspace: string | null,
        newWorkspace: string
    ): Promise<boolean> {

        const _teamSettingRepository = manager.getRepository(TeamSetting);

        const workspaceStatus = await this._updateTeamWorkspaceRecord(
            previousWorkspace,
            newWorkspace
        );

        await _teamSettingRepository.update({ teamId }, { workspace: newWorkspace });

        return workspaceStatus;
    }

    // TODO: it should be wrapped by rxjs finalized.
    async _updateTeamWorkspaceRecord(
        previousWorkspace: string | null,
        newWorkspace: string
    ): Promise<boolean> {

        // for validation again
        const _workspaceUsageStatus = await this.syncdayRedisService.getWorkspaceStatus(
            newWorkspace
        );

        if (_workspaceUsageStatus === true) {
            throw new AlreadyUsedInWorkspace();
        }

        if (previousWorkspace) {
            await this.syncdayRedisService.deleteWorkspaceStatus(previousWorkspace);
        }

        const workspaceStatus = await this.syncdayRedisService.setWorkspaceStatus(newWorkspace);

        return workspaceStatus;
    }
}
