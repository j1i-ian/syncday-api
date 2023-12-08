import { Injectable } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '@entity/teams/team.entity';

@Injectable()
export class TeamService {

    constructor(
        @InjectRepository(Team) private readonly teamRepository: Repository<Team>
    ) {}

    findTeamByWorkspace(teamWorkspace: string): Observable<Team> {
        return from(
            this.teamRepository.findOneOrFail({
                where: {
                    teamSetting: {
                        workspace: teamWorkspace
                    }
                },
                relations: ['teamSetting', 'profiles', 'profiles.user']
            })
        );
    }

}
