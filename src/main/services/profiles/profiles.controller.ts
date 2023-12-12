import { Controller, Get, Param } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ProfilesService } from '@services/profiles/profiles.service';
import { Profile } from '@entity/profiles/profile.entity';

@Controller()
export class ProfilesController {

    constructor(
        private readonly profileService: ProfilesService
    ) {}

    @Get(':profileId')
    get(@Param('profileId') profileId: number): Observable<Profile> {
        return this.profileService.findProfileById(profileId);
    }
}
