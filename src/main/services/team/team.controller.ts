import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { TeamService } from '@services/team/team.service';
import { Team } from '@entity/teams/team.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { CreateTeamRequestDto } from '@dto/teams/create-team-request.dto';

@Controller()
export class TeamController {

    constructor(
        private readonly teamService: TeamService
    ) {}

    @Get()
    search(
        @AuthProfile('userId') userId: number
    ): Observable<Team[]> {
        return this.teamService.search(userId);
    }

    @Get(':teamId(\\d+)')
    get(
        @AuthProfile() authProfile: AppJwtPayload
    ): Observable<Team> {
        return this.teamService.get(authProfile.teamId);
    }

    @Post()
    create(
        @AuthProfile() authProfile: AppJwtPayload,
        @Body() createTeamRequestDto: CreateTeamRequestDto
    ): Observable<Team> {

        const newOrder = createTeamRequestDto.order;
        const newTeam = {
            name: createTeamRequestDto.name,
            logo: createTeamRequestDto.logo
        } as Team;
        const newTeamSetting = {
            workspace: createTeamRequestDto.link,
            greetings: createTeamRequestDto.greetings
        } as Pick<TeamSetting, 'workspace' | 'greetings'>;

        const newPaymentMethod = createTeamRequestDto.paymentMethod;
        const newTeamMembers = createTeamRequestDto.invitedMembers;

        if (newOrder.unit !== newTeamMembers.length + 1) {
            throw new BadRequestException('Order unit is invalid. Plase check your order option');
        }

        return this.teamService.create(
            newOrder,
            newPaymentMethod,
            newTeam,
            newTeamSetting,
            newTeamMembers,
            authProfile.userId
        );
    }

    @Patch(':teamId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    patch(
        @AuthProfile('teamId') teamId: number,
        @Body() patchTeamRequestDto: Pick<Team, 'name' | 'logo'>
    ): Observable<boolean> {
        return this.teamService.patch(teamId, {
            name: patchTeamRequestDto.name,
            logo: patchTeamRequestDto.logo
        });
    }
}
