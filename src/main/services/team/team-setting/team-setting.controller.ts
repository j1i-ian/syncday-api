import { Controller, Get, Header, Query } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { TeamSettingSearchOption } from '@interfaces/teams/team-settings/team-setting-search-option.interface';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';

@Controller()
export class TeamSettingController {
    constructor(private readonly teamSettingService: TeamSettingService) {}

    @Get()
    @Header('Content-type', 'application/json')
    searchTeamSettings(@Query('workspace') workspace?: string): Observable<boolean> {
        return this.teamSettingService
            .searchTeamSettings({
                workspace
            } as TeamSettingSearchOption)
            .pipe(map((searchedTeamSettings) => searchedTeamSettings.length > 0));
    }
}
