import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Observable, combineLatest, from, map, mergeMap, toArray, zip } from 'rxjs';
import { SearchByProfileOption } from '@interfaces/profiles/search-by-profile-option.interface';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { InvitedNewTeamMember } from '@services/team/invited-new-team-member.type';
import { Profile } from '@entity/profiles/profile.entity';
import { User } from '@entity/users/user.entity';

@Injectable()
export class ProfilesService {

    constructor(
        private readonly profilesRedisRepository: ProfilesRedisRepository,
        @InjectRepository(Profile) private readonly profileRepository: Repository<Profile>
    ) {}

    searchByTeamId(teamId: number): Observable<Profile[]> {
        return from(this.profileRepository.find({
            where: {
                teamId
            }
        }));
    }

    findProfile(searchByProfileOption: SearchByProfileOption): Observable<Profile> {

        const {
            profileId,
            teamId,
            userId
        } = searchByProfileOption;

        return from(this.profileRepository.findOneOrFail({
            relations: [
                'user',
                'user.oauth2Accounts',
                'team',
                'googleIntergrations',
                'appleCalDAVIntegrations',
                'zoomIntegrations'
            ],
            where: {
                id: profileId,
                teamId,
                userId
            }
        }));
    }

    createInvitedProfiles(
        user: Pick<User, 'id' | 'email' | 'phone'>
    ): Observable<Profile[]> {

        return zip(
            this.profilesRedisRepository.getInvitedTeamIds(user.email),
            this.profilesRedisRepository.getInvitedTeamIds(user.phone)
        ).pipe(
            mergeMap(([_emailTeamIds, _phoneTeamIds]) => from(_emailTeamIds.concat(_phoneTeamIds))),
            map((_teamId) => (this.profileRepository.create({
                teamId: _teamId,
                userId: user.id
            }))),
            toArray(),
            mergeMap((_newProfiles) => from(this.profileRepository.save(_newProfiles)))
        );
    }

    async _create(
        transactionManager: EntityManager,
        newProfile: Partial<Profile> | Array<Partial<Profile>>
    ): Promise<Profile | Profile[]> {
        const profileRepository = transactionManager.getRepository(Profile);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        const createdProfile = profileRepository.create(newProfile as any);

        const savedProfile = await profileRepository.save(createdProfile);

        return savedProfile;
    }

    saveInvitedNewTeamMember(
        createdTeamId: number,
        invitedNewMembers: InvitedNewTeamMember[]
    ): Observable<boolean> {
        return this.profilesRedisRepository.setInvitedNewTeamMembers(
            createdTeamId,
            invitedNewMembers
        );
    }

    patch(profileId: number, partialProfile: Partial<Profile>): Observable<boolean> {
        return from(
            this.profileRepository.update(
                { id: profileId },
                partialProfile
            )
        ).pipe(
            map((updateResult) => !!(updateResult &&
                updateResult.affected &&
                updateResult.affected > 0))
        );
    }

    completeInvitation(
        user: Pick<User, 'id' | 'email' | 'phone'>
    ): Observable<boolean> {
        return combineLatest([
            this.profilesRedisRepository.deleteTeamInvitations(user.email),
            this.profilesRedisRepository.deleteTeamInvitations(user.phone)
        ]).pipe(map(() => true));
    }
}
