import { Controller, Get } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { TeamService } from '@services/team/team.service';
import { Team } from '@entity/teams/team.entity';

@Controller()
export class TeamController {

    constructor(
        private readonly teamService: TeamService
    ) {}

    @Get()
    search(
        @AuthProfile() authProfile: AppJwtPayload
    ): Observable<Team[]> {
        return this.teamService.searchByProfileId(authProfile.id);
    }

    @Get(':teamId')
    get(
        @AuthProfile() authProfile: AppJwtPayload
    ): Observable<Team> {
        return this.teamService.get(authProfile.teamId);
    }
}
