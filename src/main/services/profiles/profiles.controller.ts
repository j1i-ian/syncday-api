import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Put } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { ProfilesService } from '@services/profiles/profiles.service';
import { Profile } from '@entity/profiles/profile.entity';
import { PatchProfileRequestDto } from '@dto/profiles/patch-profile-request.dto';
import { FetchProfileResponseDto } from '@dto/profiles/fetch-profile-response.dto';
import { PatchAllProfileRequestDto } from '@dto/profiles/patch-all-profile-request.dto';

@Controller()
export class ProfilesController {

    constructor(
        private readonly profileService: ProfilesService
    ) {}

    @Get()
    search(
        @AuthProfile('userId') userId: number
    ): Observable<FetchProfileResponseDto[]> {
        return this.profileService.searchByUserId(userId).pipe(
            map((searchedProfiles) =>
                searchedProfiles.map(
                    (_searchedProfile) =>
                        plainToInstance(FetchProfileResponseDto, _searchedProfile, {
                            excludeExtraneousValues: true
                        })
                )
            )
        );
    }

    @Get(':profileId(\\d+)')
    get(
        @AuthProfile('id') profileId: number
    ): Observable<FetchProfileResponseDto> {
        return this.profileService.findProfile({
            profileId
        }).pipe(
            map((loadedProfile) => plainToInstance(FetchProfileResponseDto, loadedProfile, {
                excludeExtraneousValues: true
            }))
        );
    }

    @Patch()
    @HttpCode(HttpStatus.NO_CONTENT)
    patchAll(
        @AuthProfile('userId') userId: number,
        @Body() patchAllProfileRequestDto: PatchAllProfileRequestDto
    ): Observable<boolean> {
        return this.profileService.patchAll(
            userId,
            patchAllProfileRequestDto as Partial<Profile>
        );
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
