import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, from } from 'rxjs';
import { Profile } from '@entity/profiles/profile.entity';

@Injectable()
export class ProfilesService {

    constructor(
        @InjectRepository(Profile) private readonly profileRepository: Repository<Profile>
    ) {}

    findProfileById(profileId: number): Observable<Profile> {
        return from(this.profileRepository.findOneOrFail({
            relations: [
                'user',
                'user.oauth2Accounts',
                'googleIntergrations',
                'appleCalDAVIntegrations',
                'zoomIntegrations'
            ],
            where: {
                id: profileId
            }
        }));
    }
}
