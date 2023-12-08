import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';
import { User } from '@entity/users/user.entity';

export interface CreatedUserAndTeam {
    createdUser: User;
    createdProfile: Profile;
    createdTeam: Team;
}
