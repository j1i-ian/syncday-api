import { Profile } from '@core/entities/profiles/profile.entity';

export type NewProfile = Pick<Profile, 'teamId' | 'userId'>;
