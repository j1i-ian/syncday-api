import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Observable, from, map } from 'rxjs';
import { SearchByProfileOption } from '@interfaces/profiles/search-by-profile-option.interface';
import { Profile } from '@entity/profiles/profile.entity';

@Injectable()
export class ProfilesService {

    constructor(
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
}
