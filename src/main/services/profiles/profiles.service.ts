import { ForbiddenException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Raw, Repository, UpdateResult } from 'typeorm';
import { Observable, combineLatest, defer, filter, firstValueFrom, from, iif, map, merge, mergeMap, of, reduce, tap, toArray } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { Role } from '@interfaces/profiles/role.enum';
import { ProfileSearchOption } from '@interfaces/profiles/profile-search-option.interface';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { OrderStatus } from '@interfaces/orders/order-status.enum';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { UserService } from '@services/users/user.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { UtilService } from '@services/util/util.service';
import { ProductsService } from '@services/products/products.service';
import { OrdersService } from '@services/orders/orders.service';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { PaymentsService } from '@services/payments/payments.service';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';

@Injectable()
export class ProfilesService {

    constructor(
        private readonly utilService: UtilService,
        private readonly productsService: ProductsService,
        private readonly ordersService: OrdersService,
        private readonly paymentMethodService: PaymentMethodService,
        private readonly paymentsService: PaymentsService,
        private readonly notificationsService: NotificationsService,
        private readonly profilesRedisRepository: ProfilesRedisRepository,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(Profile) private readonly profileRepository: Repository<Profile>
    ) {}

    filterProfiles(
        teamId: number,
        newInvitationTeamMembers: InvitedNewTeamMember[]
    ): Observable<InvitedNewTeamMember[]> {

        const emailBulk = newInvitationTeamMembers.map((_newInvite) => _newInvite.email)
            .filter((bulkElement) => !!bulkElement) as string[];
        const phoneNumberBulk = newInvitationTeamMembers.map((_newInvite) => _newInvite.phone)
            .filter((bulkElement) => !!bulkElement) as string[];

        const emailOrPhoneBulk = emailBulk.concat(phoneNumberBulk);

        // check nosql db
        const invitedNewTeamMembers$ = from(this.profilesRedisRepository.filterAlreadyInvited(teamId, emailOrPhoneBulk))
            .pipe(
                mergeMap((alreadyInvitedEmailOrPhoneBulk) => from(alreadyInvitedEmailOrPhoneBulk)),
                map((alreadyInvitedEmailOrPhone) => this.utilService.convertToInvitedNewTeamMember(alreadyInvitedEmailOrPhone))
            );

        const alreadyJoinedTeamProfiles$ = from(
            this.profileRepository.createQueryBuilder('profile')
                .select([
                    'profile.id',
                    'user.email',
                    'user.phone'
                ])
                .leftJoinAndSelect('profile.user', 'user')
                .where('profile.teamId = :teamId', { teamId })
                .andWhere(new Brackets((qb) => {
                    qb.where('user.email IN (:...emailBulk)', { emailBulk })
                        .orWhere('user.phone IN (:...phoneNumberBulk)', { phoneNumberBulk });
                }))
                .groupBy('user.email')
                .addGroupBy('user.phone')
                .getMany()
        ).pipe(
            mergeMap((_profiles) => from(_profiles)),
            map(({ user: profileUser }) => [profileUser.email, profileUser.phone]),
            filter(([email, phone]) => emailBulk.includes(email) || phoneNumberBulk.includes(phone)),
            map(([email, phone]) => ({ email, phone } as InvitedNewTeamMember))
        );

        return merge(invitedNewTeamMembers$, alreadyJoinedTeamProfiles$)
            .pipe(
                reduce((acc, curr) => acc.concat(curr), [] as InvitedNewTeamMember[])
            );
    }

    search(
        {
            userId,
            teamId,
            withUserData
        }: Partial<ProfileSearchOption>
    ): Observable<Profile[]> {

        return of(this.profileRepository.createQueryBuilder('profile'))
            .pipe(
                tap((searchQueryBuilder) => {
                    if (userId) {
                        searchQueryBuilder.where('profile.userId = :userId', { userId });
                    }
                }),
                tap((searchQueryBuilder) => {
                    if (teamId) {
                        searchQueryBuilder.andWhere('profile.teamId = :teamId', { teamId });
                    }
                }),
                tap((searchQueryBuilder) => {
                    if (withUserData) {
                        searchQueryBuilder.addSelect([
                            'user.id',
                            'user.email',
                            'user.phone'
                        ]).leftJoin(
                            'profile.user',
                            'user'
                        );
                    }
                }),
                tap((searchQueryBuilder) => {
                    searchQueryBuilder
                        .addSelect(
                            `CASE
                                WHEN profile.roles LIKE :ownerRole THEN 1
                                WHEN profile.roles LIKE :managerRole THEN 2
                                ELSE 3
                            END`,
                            'orderCondition'
                        ).orderBy('orderCondition', 'ASC')
                        .setParameter('ownerRole', Role.OWNER)
                        .setParameter('managerRole', Role.MANAGER);
                }),
                tap((searchQueryBuilder) => {
                    searchQueryBuilder.take(20);
                }),
                mergeMap((searchQueryBuilder) => searchQueryBuilder.getMany())
            );
    }

    fetch(profileSearchOption: Partial<ProfileSearchOption>): Observable<Profile> {

        const {
            id,
            teamId,
            userId
        } = profileSearchOption;

        return from(this.profileRepository.findOneOrFail({
            relations: {
                user: {
                    oauth2Accounts: true
                },
                team: true,
                googleIntergrations: true,
                appleCalDAVIntegrations: true,
                zoomIntegrations: true
            },
            where: {
                id,
                teamId,
                userId
            }
        }));
    }

    _fetchTeamOwnerProfile(teamId: number): Observable<Profile> {
        return from(this.profileRepository.findOneOrFail({
            select: {
                id: true,
                user: { email: true, phone: true },
                team: { name: true }
            },
            relations: {
                user: true,
                team: true
            },
            where: {
                teamId,
                roles: Raw((alias) => `${alias} LIKE '%${Role.OWNER}%'`)
            }
        }));
    }

    createBulk(
        teamId: number,
        newInvitedNewMembers: Array<Pick<Partial<User>, 'email' | 'phone'>>,
        orderer: Orderer
    ): Observable<boolean> {

        const emailBulk = newInvitedNewMembers
            .map((_newInvitationTeamMember) => _newInvitationTeamMember.email)
            .filter((bulkElement) => !!bulkElement) as string[];

        const phoneNumberBulk = newInvitedNewMembers.map((_newInvite) => _newInvite.phone)
            .filter((bulkElement) => !!bulkElement) as string[];

        const teamPaymentMethod$ = from(this.paymentMethodService.fetch({ teamId }));
        const buyer$ = this._fetchTeamOwnerProfile(teamId)
            .pipe(
                map((ownerProfile) => ({
                    name: ownerProfile.name,
                    email: ownerProfile.user.email,
                    phone: ownerProfile.user.phone
                } as Buyer))
            );

        const orderUnit = newInvitedNewMembers.length;

        return combineLatest([
            // product id 2 is 'invitation'
            this.productsService.findTeamPlanProduct(2),
            from(this.userService.search({
                emails: emailBulk,
                phones: phoneNumberBulk
            })),
            buyer$,
            teamPaymentMethod$
        ]).pipe(
            mergeMap(([
                loadedProduct,
                searchedUsers,
                buyer,
                teamPaymentMethod
            ]) => this.datasource.transaction(async (transactionManager) => {

                const _createdOrder = await this.ordersService._create(
                    transactionManager,
                    loadedProduct,
                    orderUnit,
                    teamId,
                    orderer
                );

                await this.paymentsService._create(
                    transactionManager,
                    _createdOrder,
                    teamPaymentMethod,
                    buyer
                );

                await this.ordersService._updateOrderStatus(
                    transactionManager,
                    _createdOrder.id,
                    OrderStatus.PLACED
                );

                const _allProfiles = searchedUsers.map((_user) => this.utilService.createNewProfile(teamId, _user.id));

                await this._create(transactionManager, _allProfiles, {
                    reload: false
                }) as Profile[];

                return searchedUsers;
            })),
            mergeMap((searchedUsers) => {

                const invitedNewUsers = this.utilService.filterInvitedNewUsers(newInvitedNewMembers, searchedUsers);

                return invitedNewUsers.length > 0 ?
                    this.saveInvitedNewTeamMember(teamId, invitedNewUsers)
                        .pipe(
                            mergeMap(() => this.notificationsService.sendTeamInvitationForNewUsers(invitedNewUsers)),
                            map(() => true)
                        ) : of(true);
            })
        );
    }

    createInvitedProfiles(
        user: Pick<User, 'id' | 'email' | 'phone'>
    ): Observable<Profile[]> {

        const emailOrPhone = user.email || user.phone;

        return this.profilesRedisRepository.getInvitedTeamIds(emailOrPhone).pipe(
            mergeMap((allTeamIds) => from(allTeamIds)),
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
        newProfile: Partial<Profile> | Array<Partial<Profile>>,
        {
            reload
        } = {
            reload: true
        }
    ): Promise<Profile | Profile[]> {
        const profileRepository = transactionManager.getRepository(Profile);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        const createdProfile = profileRepository.create(newProfile as any);

        const savedProfile = await profileRepository.save(createdProfile, {
            reload
        });

        return savedProfile;
    }

    checkAlreadyInvited(
        invitedNewTeamMember: InvitedNewTeamMember,
        teamId: number
    ): Observable<boolean> {
        const invitedNewUserEmailOrPhone = (invitedNewTeamMember.email || invitedNewTeamMember.phone) as string;

        return this.profilesRedisRepository.getInvitedTeamIds(invitedNewUserEmailOrPhone)
            .pipe(
                map((invitedTeamIds) => {
                    const alreadyInvited = invitedTeamIds.includes(teamId);

                    return alreadyInvited;
                })
            );
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
}
