import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Put } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { ProfilesService } from '@services/profiles/profiles.service';
import { Profile } from '@entity/profiles/profile.entity';
import { PatchProfileRequestDto } from '@dto/profiles/patch-profile-request.dto';

@Controller()
export class ProfilesController {

    constructor(
        private readonly profileService: ProfilesService
    ) {}

    @Get(':profileId(\\d+)')
    get(
        @AuthProfile('id') profileId: number
    ): Observable<Profile> {
        return this.profileService.findProfile({
            profileId
        });
    }

    @Patch(':profileId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    patch(
        @AuthProfile('id') profileId: number,
        @Body() patchProfileRequestDto: PatchProfileRequestDto
    ): Observable<boolean> {
        return this.profileService.patch(profileId, patchProfileRequestDto as Partial<Profile>);
    }

    @Put(':profileId(\\d+)/roles')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(Role.OWNER, Role.MANAGER)
    updateRole(
        @AuthProfile('id') profileId: number,
        @AuthProfile('roles') roles: Role[],
        @AuthProfile('teamId') teamId: number,
        @Param('profileId') targetProfileId: number,
        @Body() updateRoles: Role[]
    ): Observable<boolean> {
        return this.profileService.updateRoles(
            teamId,
            profileId,
            roles,
            targetProfileId,
            updateRoles
        );
    }
}
