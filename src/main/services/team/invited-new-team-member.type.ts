import { Profile } from '@entity/profiles/profile.entity';
import { User } from '@entity/users/user.entity';

export type InvitedNewTeamMember = Partial<Pick<User, 'email' | 'phone'>> & Partial<Pick<Profile, 'teamId'>>;
