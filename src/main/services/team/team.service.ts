import { Injectable } from '@nestjs/common';
import { Observable, from, map } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '@entity/teams/team.entity';

@Injectable()
export class TeamService {

    constructor(
        @InjectRepository(Team) private readonly teamRepository: Repository<Team>
    ) {}

    searchByProfileId(profileId: number): Observable<Team[]> {
        return from(
            this.teamRepository.find({
                where: {
                    profiles: {
                        id: profileId
                    }
                },
                relations: ['teamSetting']
            })
        );
    }

    get(teamId: number): Observable<Team> {
        return from(
            this.teamRepository.findOneByOrFail({
                id: teamId
            })
        );
    }

    findByWorkspace(teamWorkspace: string): Observable<Team> {
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

    patch(
        teamId: number,
        patchTeamRequestDto: Pick<Team, 'name' | 'avatar'>
    ): Observable<boolean> {
        return from(
            this.teamRepository.update(
                { id: teamId },
                {
                    name: patchTeamRequestDto.name,
                    avatar: patchTeamRequestDto.avatar
                }
            )
        ).pipe(
            map((updateResult) => !!(updateResult &&
                updateResult.affected &&
                updateResult.affected > 0))
        );
    }
}
