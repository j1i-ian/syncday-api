import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { SearchByProfileOption } from '@interfaces/profiles/search-by-profile-option.interface';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { ProfilesService } from '@services/profiles/profiles.service';
import { InvitedNewTeamMember } from '@services/team/invited-new-team-member.type';
import { Profile } from '@entity/profiles/profile.entity';
import { PatchProfileRequestDto } from '@dto/profiles/patch-profile-request.dto';
import { FetchProfileResponseDto } from '@dto/profiles/fetch-profile-response.dto';
import { PatchAllProfileRequestDto } from '@dto/profiles/patch-all-profile-request.dto';
import { PatchProfileRolesRequest } from '@dto/profiles/patch-profile-roles-request.dto';
import { CreateProfileRequestDto } from '@dto/profiles/create-profile-request.dto';

@Controller()
export class ProfilesController {

    constructor(
        private readonly profileService: ProfilesService
    ) {}

    @Get()
    search(
        @AuthProfile() authProfile: AppJwtPayload,
        @Query() searchOptions: Partial<SearchByProfileOption>,
        @Query('withUserData') withUserDataString: string | boolean | undefined
    ): Observable<FetchProfileResponseDto[]> {

        searchOptions.withUserData = withUserDataString === 'true' || withUserDataString === true;

        const options = this._parseSearchOption(
            authProfile,
            searchOptions
        );

        return this.profileService.search(options).pipe(
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

    @Post()
    @Roles(Role.OWNER, Role.MANAGER)
    create(
        @AuthProfile('teamId') teamId: number,
        @Body() createProfileRequestDto: CreateProfileRequestDto
    ): Observable<Profile | InvitedNewTeamMember> {

        return this.profileService.create(teamId, {
            email: createProfileRequestDto.email,
            phone: createProfileRequestDto.phone
        });
    }

    /**
     * This API is used for accepting an invitation
     */
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
        @AuthProfile('roles') authRoles: Role[],
        @AuthProfile('teamId') teamId: number,
        @Param('profileId') targetProfileId: number,
        @Body() patchProfileRolesRequest: PatchProfileRolesRequest
    ): Observable<boolean> {

        // TODO: it should be extracted as decorator
        this.profileService.validateRoleUpdateRequest(authRoles, patchProfileRolesRequest.roles);

        return this.profileService.updateRoles(
            teamId,
            profileId,
            targetProfileId,
            patchProfileRolesRequest.roles
        );
    }

    @Delete(':profileId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(Role.OWNER, Role.MANAGER)
    remove(
        @Param('profileId') profileId: number,
        @AuthProfile('teamId') teamId: number
    ): Observable<boolean> {
        return this.profileService.remove(teamId, profileId);
    }

    /**
     * query param's existence indicates that field is used as an search option
     */
    _parseSearchOption(
        {
            teamId: authTeamId,
            userId: authUserId
        }: Pick<AppJwtPayload, 'userId' | 'teamId'>,
        {
            teamId,
            userId,
            withUserData
        }: Partial<SearchByProfileOption>
    ): Partial<SearchByProfileOption> {

        const teamIdOption = teamId ? authTeamId : undefined;

        const isAllSearchOptionDisabled = teamIdOption === undefined || userId;

        const userIdOption = isAllSearchOptionDisabled
            ? authUserId
            : undefined;

        return {
            userId: userIdOption,
            teamId: teamIdOption,
            withUserData
        };
    }
}
