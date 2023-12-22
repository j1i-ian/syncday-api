import { Body, Controller, Get, Header, HttpCode, HttpStatus, Patch, Put, Query } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { TeamSettingSearchOption } from '@interfaces/teams/team-settings/team-setting-search-option.interface';
import { Role } from '@interfaces/profiles/role.enum';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { UpdateTeamWorkspaceRequestDto } from '@dto/teams/update-team-workspace-request.dto';
import { PatchTeamBrandRequestDto } from '@dto/teams/patch-team-brand-request.dto';

@Controller()
export class TeamSettingController {
    constructor(private readonly teamSettingService: TeamSettingService) {}

    /**
     * Even now, we are temporarily using GET
     * because Nest.js has arbitrarily overridden the custom method supported by Node
     *
     * this api method should be custom http method 'CHECK'.
     *
     * @param workspace
     * @returns
     */
    @Get()
    @Header('Content-type', 'application/json')
    search(@Query('workspace') workspace?: string): Observable<boolean> {
        return this.teamSettingService
            .search({
                workspace
            } as TeamSettingSearchOption)
            .pipe(map((searchedTeamSettings) => searchedTeamSettings.length > 0));
    }

    @Patch(':teamSettingId(\\d+)')
    @Roles(Role.OWNER, Role.MANAGER)
    @HttpCode(HttpStatus.NO_CONTENT)
    patch(
        @AuthProfile('teamId') teamId: number,
        @Body() patchTeamBrandRequestDto: PatchTeamBrandRequestDto
    ): Observable<boolean> {
        return this.teamSettingService.patch(teamId, patchTeamBrandRequestDto as TeamSetting);
    }

    @Put(':teamSettingId(\\d+)/workspace')
    @Roles(Role.OWNER, Role.MANAGER)
    @HttpCode(HttpStatus.NO_CONTENT)
    async patchTeamWorkspace(
        @AuthProfile('teamId') teamId: number,
        @Body() updateTeamWorkspaceRequestDto: UpdateTeamWorkspaceRequestDto
    ): Promise<boolean> {
        const newWorkspace = updateTeamWorkspaceRequestDto.workspace;

        return this.teamSettingService.updateTeamWorkspace(teamId, newWorkspace);
    }
}
