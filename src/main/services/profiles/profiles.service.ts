import { ForbiddenException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsRelations, FindOptionsSelect, Repository, UpdateResult } from 'typeorm';
import { Observable, combineLatest, defer, firstValueFrom, from, iif, map, merge, mergeMap, of, reduce, toArray, zip } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { SearchByProfileOption } from '@interfaces/profiles/search-by-profile-option.interface';
import { Role } from '@interfaces/profiles/role.enum';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { InvitedNewTeamMember } from '@services/team/invited-new-team-member.type';
import { UserService } from '@services/users/user.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { UtilService } from '@services/util/util.service';
import { Profile } from '@entity/profiles/profile.entity';
import { User } from '@entity/users/user.entity';

@Injectable()
export class ProfilesService {

    constructor(
        private readonly utilService: UtilService,
        private readonly profilesRedisRepository: ProfilesRedisRepository,
        private readonly notificationsService: NotificationsService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(Profile) private readonly profileRepository: Repository<Profile>
    ) {}

    searchByTeamId(teamId: number): Observable<Profile[]> {
        return from(this.profileRepository.find({
            where: {
                teamId
            }
        }));
    }

    searchByUserId(
        {
            userId,
            teamId,
            withUserData
        }: Partial<SearchByProfileOption>
    ): Observable<Profile[]> {

        const withUserDataOption = withUserData
            ? this._getWithUserData()
            : {};

        return from(this.profileRepository.find({
            ...withUserDataOption,
            where: {
                userId,
                teamId
            },
            take: 20
        }));
    }

    findProfile(searchByProfileOption: Partial<SearchByProfileOption>): Observable<Profile> {

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

    create(
        teamId: number,
        invitedNewUser: Pick<Partial<User>, 'email' | 'phone'>
    ): Observable<Profile | InvitedNewTeamMember> {
        return from(this.userService.searchByEmailOrPhone([
            { email: invitedNewUser.email },
            { phone: invitedNewUser.phone }
        ])).pipe(
            map((searchedUsers) => searchedUsers.length > 0 ? searchedUsers.pop() : null),
            map((searchedUser) =>
                [
                    searchedUser,
                    [{ teamId, ...invitedNewUser }] as InvitedNewTeamMember[]
                ] as [User, InvitedNewTeamMember[]]),
            mergeMap(([ searchedUser, invitedNewTeamMembers ]: [User, InvitedNewTeamMember[]]) => (
                this.saveInvitedNewTeamMember(teamId, invitedNewTeamMembers)
                // create a profile then link to the user
                    .pipe(
                        mergeMap(() =>
                            searchedUser ? this.createInvitedProfiles(searchedUser)
                                : // create a profile for new user
                                this.notificationsService.sendTeamInvitationForNewUsers(invitedNewTeamMembers)
                                    .pipe(map(() => invitedNewTeamMembers))
                        ),
                        map((createdProfiles) => createdProfiles[0])
                    )
            ))
        );
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
        return this._patch(
            this.profileRepository.manager,
            profileId,
            partialProfile
        );
    }

    _patch(
        transactionManager: EntityManager,
        profileId: number,
        partialProfile: Partial<Profile>
    ): Observable<boolean> {
        return of(transactionManager.getRepository(Profile))
            .pipe(
                mergeMap(
                    (profileRepository) =>
                        profileRepository.update(
                            profileId,
                            partialProfile
                        )
                ),
                map((updateResult) =>
                    Boolean(
                        updateResult.affected
                        && updateResult.affected > 0
                    )
                )
            );
    }

    patchAll(userId: number, partialProfile: Partial<Profile>): Observable<boolean> {
        return from(
            this.profileRepository.update(
                { userId },
                partialProfile
            )
        ).pipe(
            map((updateResult) => !!(updateResult &&
                updateResult.affected &&
                updateResult.affected > 0))
        );
    }

    updateRoles(
        teamId: number,
        profileId: number,
        targetProfileId: number,
        updateRoles: Role[]
    ): Observable<boolean> {
        return from(defer(() => this.datasource.transaction(async (manager) => {
            const result = await firstValueFrom(this._updateRoles(
                manager,
                teamId,
                profileId,
                targetProfileId,
                updateRoles
            ));

            return result;
        })));
    }

    _updateRoles(
        transactionManager: EntityManager,
        teamId: number,
        profileId: number,
        targetProfileId: number,
        updateRoles: Role[]
    ): Observable<boolean> {

        const transactionProfileRepository$ = of(transactionManager.getRepository(Profile));

        const roleUpdate$ = transactionProfileRepository$
            .pipe(
                mergeMap((_profileRepository) =>
                    from(_profileRepository.update(
                        { id: targetProfileId, teamId },
                        { roles: updateRoles }
                    ))
                ),
                map((__updateResult: UpdateResult) => this.utilService.convertUpdateResultToBoolean(__updateResult))
            );

        const ensuredMigrationOwnerRole$ = iif(
            () => updateRoles.includes(Role.OWNER),
            transactionProfileRepository$
                .pipe(
                    mergeMap((_profileRepository) =>
                        _profileRepository.update(
                            { id: profileId, teamId },
                            { roles: [Role.MANAGER] }
                        )),
                    map((__updateResult: UpdateResult) => this.utilService.convertUpdateResultToBoolean(__updateResult))
                ),
            of(true)
        );

        return merge(roleUpdate$, ensuredMigrationOwnerRole$)
            .pipe(reduce((acc, curr) => acc && curr));
    }

    completeInvitation(
        user: Pick<User, 'id' | 'email' | 'phone'>
    ): Observable<boolean> {
        return combineLatest([
            this.profilesRedisRepository.deleteTeamInvitations(user.email),
            this.profilesRedisRepository.deleteTeamInvitations(user.phone)
        ]).pipe(map(() => true));
    }

    remove(teamId: number, profileId: number): Observable<boolean> {
        return from(
            this.profileRepository.delete({
                id: profileId,
                teamId
            })
        ).pipe(
            map((deleteResult) =>!!(deleteResult &&
                deleteResult.affected &&
                deleteResult.affected > 0))
        );
    }

    validateRoleUpdateRequest(
        authRoles: Role[],
        updateRoles: Role[]
    ): void {

        const isValidRoleUpdateRequest = this.utilService.isValidRoleUpdateRequest(authRoles, updateRoles);

        const isForbiddenPermissionRequest = !isValidRoleUpdateRequest;

        if (isForbiddenPermissionRequest) {
            throw new ForbiddenException('Permission denied');
        }
    }

    _getWithUserData(): {
        relations: FindOptionsRelations<Profile>;
        select: FindOptionsSelect<Profile>;
    } {

        const relations = ['user'] as FindOptionsRelations<Profile>;
        const select = {
            user: {
                email: true,
                phone: true
            }
        };

        return {
            relations,
            select
        };
    }
}
