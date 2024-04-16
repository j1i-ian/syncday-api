import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Inject, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { Observable, catchError, filter, from, map, mergeMap, of, tap, throwIfEmpty } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Response } from 'express';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { ProfileSearchOption } from '@interfaces/profiles/profile-search-option.interface';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { ProfilesService } from '@services/profiles/profiles.service';
import { UtilService } from '@services/util/util.service';
import { Profile } from '@entity/profiles/profile.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { PatchProfileRequestDto } from '@dto/profiles/patch-profile-request.dto';
import { FetchProfileResponseDto } from '@dto/profiles/fetch-profile-response.dto';
import { PatchAllProfileRequestDto } from '@dto/profiles/patch-all-profile-request.dto';
import { PatchProfileRolesRequest } from '@dto/profiles/patch-profile-roles-request.dto';
import { CreateProfileBulkRequestDto } from '@dto/profiles/create-profile-bulk-request.dto';
import { BootpayException } from '@exceptions/bootpay.exception';

@Controller()
export class ProfilesController {

    constructor(
        private readonly profileService: ProfilesService,
        private readonly utilService: UtilService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    /**
     * This API method should be a custom HTTP method defined AS 'FILTER'.
     * However Nest.js does not support it.
     * Or we can consider the question this api can be integrate with the create api
     * by the idempotency principle in RESTful API.
     */
    @Post('filters')
    @Roles(Role.OWNER, Role.MANAGER)
    filter(
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Body() invitedNewTeamMembers: InvitedNewTeamMember[]
    ): Observable<InvitedNewTeamMember[]> {

        return this.profileService.filterProfiles(
            teamId,
            teamUUID,
            invitedNewTeamMembers
        );
    }

    @Get()
    search(
        @AuthProfile() authProfile: AppJwtPayload,
        @Query() searchOptions: Partial<ProfileSearchOption>,
        @Query('withUserData') withUserDataString: string | boolean | undefined,
        @Query('withUnsigedUserInvitation') withUnsigedUserInvitationString: string | boolean | undefined
    ): Observable<FetchProfileResponseDto[]> {

        searchOptions.withUserData = withUserDataString === 'true' || withUserDataString === true;
        searchOptions.withUnsigedUserInvitation = withUnsigedUserInvitationString === 'true' || withUnsigedUserInvitationString === true;

        const patchedSearchOption = this.utilService.patchSearchOption(
            searchOptions,
            authProfile
        );

        return this.profileService.search({
            withUserData: searchOptions.withUserData,
            withUnsigedUserInvitation: searchOptions.withUnsigedUserInvitation,
            id: patchedSearchOption.profileId,
            uuid: patchedSearchOption.profileUUID,
            teamId: patchedSearchOption.teamId,
            teamUUID: patchedSearchOption.teamUUID,
            userId: patchedSearchOption.userId
        }).pipe(
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

        const { teamId, teamUUID } = authProfile;

        const orderer = {
            name: authProfile.name,
            roles: authProfile.roles,
            teamId: authProfile.teamId
        } as Orderer;

        const {
            invitedMembers,
            order,
            paymentMethod: newPaymentMethod
        } = createProfileBulkRequestDto;

        this.logger.info({
            message: 'Invitation is ordered',
            teamId,
            teamUUID,
            order,
            totalCount: invitedMembers.length
        });

        return this.profileService.createBulk(
            teamId,
            teamUUID,
            invitedMembers,
            orderer,
            newPaymentMethod as PaymentMethod
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

        return from(this.profileService.validateRoleUpdateRequest(
            authRoles,
            patchProfileRolesRequest.roles,
            targetProfileId
        )).pipe(
            mergeMap(() => this.profileService.updateRoles(
                teamId,
                profileId,
                targetProfileId,
                patchProfileRolesRequest.roles
            ))
        );
    }

    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    removeUnsignedUser(
        @AuthProfile() authProfile: Profile,
        @Body() invitedNewTeamMember: InvitedNewTeamMember
    ): Observable<boolean> {

        const emailOrPhone = (invitedNewTeamMember.email || invitedNewTeamMember.phone) as string;

        return this.profileService.removeUnsignedUserInvitation(
            authProfile.teamId,
            authProfile.teamUUID,
            emailOrPhone
        );
    }

    /**
     * Http status code 208 - Already Reported
     *
     * @see {@link [Already Reported](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/208)}
     */
    @Delete(':profileId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(
        @Param('profileId') profileId: number,
        @AuthProfile() authProfile: Profile,
        @Res() response: Response
    ): Observable<boolean> {

        this.logger.info({
            message: 'Profile Delete is requested',
            profileId,
            teamId: authProfile.teamId,
            teamUUID: authProfile.teamUUID
        });

        this.profileService.validateProfileDeleteRequest(
            authProfile.id,
            profileId,
            authProfile.roles
        );

        return from(this.profileService.remove(
            authProfile.teamId,
            authProfile,
            profileId
        )).pipe(
            tap(() => {
                this.logger.info({
                    message: 'Profile Delete is completed',
                    profileId,
                    teamId: authProfile.teamId,
                    teamUUID: authProfile.teamUUID
                });
            }),
            tap(() => {
                response.status(HttpStatus.NO_CONTENT).json();
            }),
            catchError((errorOrBootpayException) =>
                of(errorOrBootpayException)
                    .pipe(
                        filter((errorOrBootpayException) => errorOrBootpayException instanceof BootpayException),
                        tap(() => {
                            response.status(208).json({
                                exception: errorOrBootpayException.name,
                                message: errorOrBootpayException.message
                            });
                        }),
                        throwIfEmpty(() => errorOrBootpayException)
                    )
            )
        );
    }
}
