import { CreatedTeamProfile } from '@services/team/created-team-profile.interface';
import { User } from '@entity/users/user.entity';

export interface CreatedUserTeamProfile extends CreatedTeamProfile {
    createdUser: User;
}
