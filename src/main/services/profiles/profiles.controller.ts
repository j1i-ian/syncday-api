import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Observable, filter, map, mergeMap, tap, toArray } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { ProfileSearchOption } from '@interfaces/profiles/profile-search-option.interface';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { ProfilesService } from '@services/profiles/profiles.service';
import { Profile } from '@entity/profiles/profile.entity';
import { PatchProfileRequestDto } from '@dto/profiles/patch-profile-request.dto';
import { FetchProfileResponseDto } from '@dto/profiles/fetch-profile-response.dto';
import { PatchAllProfileRequestDto } from '@dto/profiles/patch-all-profile-request.dto';
import { PatchProfileRolesRequest } from '@dto/profiles/patch-profile-roles-request.dto';
import { CreateProfileRequestDto } from '@dto/profiles/create-profile-request.dto';
import { NoNewbieMemberInBulkException } from '@app/exceptions/profiles/no-newbie-member-in-bulk.exception';

@Controller()
export class ProfilesController {

    constructor(
        private readonly profileService: ProfilesService
    ) {}

    /**
     * this api method should be custom http method 'FILTER'.
     * But Nest.js is not support custom http method.
     *
     * @returns
     */
    @Post('filters')
    @Roles(Role.OWNER, Role.MANAGER)
    filter(
        @AuthProfile('teamId') teamId: number,
        @Body() invitedNewTeamMembers: InvitedNewTeamMember[]
    ): Observable<InvitedNewTeamMember[]> {

        return this.profileService.filterProfiles(
            teamId,
            invitedNewTeamMembers
        );
    }

    @Get()
    search(
        @AuthProfile() authProfile: AppJwtPayload,
        @Query() searchOptions: Partial<ProfileSearchOption>,
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
        @AuthProfile('id') id: number
    ): Observable<FetchProfileResponseDto> {
        return this.profileService.fetch({
            id
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

        return this.profileService.checkAlreadyInvited(createProfileRequestDto, teamId)
            .pipe(
                filter((alreadyInvited) => alreadyInvited === false),
                toArray(),
                tap((alreadyInvitedResults) => {
                    const hasNoNewbieMemberInBulk = alreadyInvitedResults.length === 0;

                    if (hasNoNewbieMemberInBulk) {
                        throw new NoNewbieMemberInBulkException();
                    }
                }),
                mergeMap(() => this.profileService.create(
                    teamId,
                    createProfileRequestDto
                ))
            );
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
        }: Partial<ProfileSearchOption>
    ): Partial<ProfileSearchOption> {

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
