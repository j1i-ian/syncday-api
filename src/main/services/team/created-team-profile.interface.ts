import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';

export interface CreatedTeamProfile {
    createdTeam: Team;
    createdProfile: Profile;
}
