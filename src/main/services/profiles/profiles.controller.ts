import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { ProfileSearchOption } from '@interfaces/profiles/profile-search-option.interface';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { ProfilesService } from '@services/profiles/profiles.service';
import { Profile } from '@entity/profiles/profile.entity';
import { PatchProfileRequestDto } from '@dto/profiles/patch-profile-request.dto';
import { FetchProfileResponseDto } from '@dto/profiles/fetch-profile-response.dto';
import { PatchAllProfileRequestDto } from '@dto/profiles/patch-all-profile-request.dto';
import { PatchProfileRolesRequest } from '@dto/profiles/patch-profile-roles-request.dto';
import { CreateProfileBulkRequestDto } from '@dto/profiles/create-profile-bulk-request.dto';

@Controller()
export class ProfilesController {

    constructor(
        private readonly profileService: ProfilesService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
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
    @Header('Content-type', 'application/json')
    createBulk(
        @AuthProfile() authProfile: AppJwtPayload,
        @Body() createProfileBulkRequestDto: CreateProfileBulkRequestDto
    ): Observable<boolean> {

        const { teamId } = authProfile;

        const orderer = {
            name: authProfile.name,
            roles: authProfile.roles,
            teamId: authProfile.teamId
        } as Orderer;

        const { invitedMembers, order } = createProfileBulkRequestDto;

        this.logger.info({
            message: 'Invitation is ordered',
            teamId,
            order,
            totalCount: createProfileBulkRequestDto.invitedMembers.length
        });

        return this.profileService.createBulk(
            teamId,
            invitedMembers,
            orderer
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
