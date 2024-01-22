import { ForbiddenException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, FindOptionsWhere, Like, Raw, Repository, UpdateResult } from 'typeorm';
import { Observable, combineLatest, defaultIfEmpty, defer, filter, firstValueFrom, from, iif, map, merge, mergeMap, of, reduce, tap, toArray, zip } from 'rxjs';
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
import { TeamService } from '@services/team/team.service';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { Order } from '@entity/orders/order.entity';
import { Team } from '@entity/teams/team.entity';
import { Availability } from '@entity/availability/availability.entity';

@Injectable()
export class ProfilesService {

    constructor(
        private readonly utilService: UtilService,
        private readonly productsService: ProductsService,
        private readonly ordersService: OrdersService,
        private readonly paymentMethodService: PaymentMethodService,
        private readonly paymentsService: PaymentsService,
        private readonly notificationsService: NotificationsService,
        private readonly teamService: TeamService,
        private readonly profilesRedisRepository: ProfilesRedisRepository,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(Profile) private readonly profileRepository: Repository<Profile>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    filterProfiles(
        teamId: number,
        teamUUID: string,
        newInvitationTeamMembers: InvitedNewTeamMember[]
    ): Observable<InvitedNewTeamMember[]> {

        const emailBulk = newInvitationTeamMembers.map((_newInvite) => _newInvite.email)
            .filter((bulkElement) => !!bulkElement) as string[];
        const phoneNumberBulk = newInvitationTeamMembers.map((_newInvite) => _newInvite.phone)
            .filter((bulkElement) => !!bulkElement) as string[];

        const emailOrPhoneBulk = emailBulk.concat(phoneNumberBulk);

        // check nosql db
        const invitedNewTeamMembers$ = defer(() => from(this.profilesRedisRepository.filterAlreadyInvited(
            teamId,
            teamUUID,
            emailOrPhoneBulk
        )))
            .pipe(
                mergeMap((alreadyInvitedEmailOrPhoneBulk) => from(alreadyInvitedEmailOrPhoneBulk)),
                map((alreadyInvitedEmailOrPhone) => this.utilService.convertToInvitedNewTeamMember(alreadyInvitedEmailOrPhone))
            );

        const alreadyJoinedTeamProfiles$ = defer(() => from(
            this.profileRepository.createQueryBuilder('profile')
                .select([
                    'profile.id',
                    'user.email',
                    'user.phone'
                ])
                .leftJoinAndSelect('profile.user', 'user')
                .where('profile.teamId = :teamId', { teamId })
                .andWhere(new Brackets((qb) => {

                    if (emailBulk.length > 0) {
                        qb.where('user.email IN (:...emailBulk)', { emailBulk });
                    }

                    if (phoneNumberBulk.length > 0) {
                        qb.orWhere('user.phone IN (:...phoneNumberBulk)', { phoneNumberBulk });
                    }
                }))
                .groupBy('user.email')
                .addGroupBy('user.phone')
                .getMany()
        )).pipe(
            mergeMap((_profiles) => from(_profiles)),
            map(({ user: profileUser }) => [profileUser.email, profileUser.phone]),
            filter(([email, phone]) =>
                !!(email && emailBulk.includes(email)) ||
                !!(phone && phoneNumberBulk.includes(phone))
            ),
            map(([email, phone]) => ({ email, phone } as InvitedNewTeamMember))
        );

        const filtered$ = newInvitationTeamMembers.length > 0
            ? merge(invitedNewTeamMembers$, alreadyJoinedTeamProfiles$)
                .pipe(
                    reduce((acc, curr) => acc.concat(curr), [] as InvitedNewTeamMember[])
                )
            : of([]);

        return filtered$;
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
                            'rolePriority'
                        ).orderBy('rolePriority', 'ASC')
                        .addOrderBy('profile.createdAt', 'ASC')
                        .setParameter('ownerRole', Role.OWNER)
                        .setParameter('managerRole', Role.MANAGER);
                }),
                tap((searchQueryBuilder) => {
                    searchQueryBuilder.take(20);
                }),
                mergeMap((searchQueryBuilder) => searchQueryBuilder.getMany())
            );
    }

    searchInvitations(teamUUID: string): Observable<InvitedNewTeamMember[]> {
        return from(this.profilesRedisRepository.getAllTeamInvitations(
            teamUUID
        )).pipe(
            mergeMap((_invitations) => from(_invitations)),
            map((_invitation) => this.utilService.convertToInvitedNewTeamMember(_invitation)),
            toArray()
        );
    }

    fetch(profileSearchOption: Partial<ProfileSearchOption>): Observable<Profile> {

        const {
            id,
            teamId,
            userId,
            role
        } = profileSearchOption;

        let findWhereOption: FindOptionsWhere<Profile> = {};

        if (id) {
            findWhereOption = {
                id
            } as FindOptionsWhere<Profile>;
        }

        if (userId) {
            findWhereOption = {
                ...findWhereOption,
                userId
            } as FindOptionsWhere<Profile>;
        }

        if (teamId) {
            findWhereOption = {
                ...findWhereOption,
                teamId
            } as FindOptionsWhere<Profile>;
        }

        if (role) {
            findWhereOption = {
                ...findWhereOption,
                roles: Like(role)
            } as FindOptionsWhere<Profile>;
        }

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
            where: findWhereOption
        }));
    }

    _fetchTeamOwnerProfile(teamId: number): Observable<Profile> {
        return from(this.profileRepository.findOneOrFail({
            select: {
                id: true,
                user: { email: true, phone: true },
                team: { name: true, createdAt: true }
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
        teamUUID: string,
        newInvitedNewMembers: InvitedNewTeamMember[],
        orderer: Orderer,
        newPaymentMethod?: PaymentMethod | undefined
    ): Observable<boolean> {

        const emailBulk = newInvitedNewMembers
            .map((_newInvitationTeamMember) => _newInvitationTeamMember.email)
            .filter((bulkElement) => !!bulkElement) as string[];

        const phoneNumberBulk = newInvitedNewMembers.map((_newInvite) => _newInvite.phone)
            .filter((bulkElement) => !!bulkElement) as string[];

        const teamPaymentMethod$ = newPaymentMethod
            ? of(null)
            : from(this.paymentMethodService.fetch({ teamId }));

        const ownerProfile$ = this._fetchTeamOwnerProfile(teamId);
        const buyerTeam$ = ownerProfile$
            .pipe(
                mergeMap((ownerProfile) =>
                    zip(
                        of(({
                            name: ownerProfile.team.name,
                            email: ownerProfile.user.email,
                            phone: ownerProfile.user.phone,
                            period: ownerProfile.team.createdAt
                        } as Buyer)),
                        of(ownerProfile.team)
                    )
                )
            );

        const orderUnit = newInvitedNewMembers.length;

        return combineLatest([
            // product id 2 is 'invitation'
            this.productsService.findTeamPlanProduct(2),
            from(this.userService.search({
                emails: emailBulk,
                phones: phoneNumberBulk
            })),
            ownerProfile$,
            buyerTeam$,
            teamPaymentMethod$
        ]).pipe(
            mergeMap(([
                loadedProduct,
                searchedUsers,
                ownerProfile,
                [buyer, team],
                teamPaymentMethod
            ]) => this.datasource.transaction(async (transactionManager) => {
                const ensuredHostName = ownerProfile.name as string || team.name;

                this.logger.info({
                    message: 'Invitation transaction is started',
                    productId: loadedProduct.id,
                    newPaymentMethod,
                    buyer,
                    ensuredHostName
                });

                const amount = loadedProduct.price * orderUnit;
                const proratedPrice = this.utilService.getProratedPrice(
                    amount,
                    team.createdAt
                );
                const proration = amount - proratedPrice;
                const _allProfiles = searchedUsers.map((_user) => this.utilService.createNewProfile(teamId, _user.id));

                const createdProfiles = await this._create(transactionManager, _allProfiles) as Profile[];

                this.logger.info({
                    message: 'Invitation transaction: Profile Bulk creating is sucess',
                    productPrice: loadedProduct.price,
                    orderUnit,
                    proration
                });

                const createdProfileIds = createdProfiles.map((_profile) => _profile.id);

                const _createdOrder = await this.ordersService._create(
                    transactionManager,
                    loadedProduct,
                    orderUnit,
                    { profileIds: createdProfileIds },
                    teamId,
                    proration,
                    orderer
                );

                this.logger.info({
                    message: 'Invitation transaction: Order is created sucessfully'
                });

                const ensuredPaymentMethod = newPaymentMethod
                    ? await this.paymentMethodService._create(
                        transactionManager,
                        newPaymentMethod,
                        buyer,
                        _createdOrder.uuid
                    ) : teamPaymentMethod as PaymentMethod;

                this.logger.info({
                    message: 'Invitation transaction: PaymentMethod is created sucessfully'
                });

                await this.paymentsService._create(
                    transactionManager,
                    proration,
                    _createdOrder,
                    ensuredPaymentMethod,
                    buyer
                );

                this.logger.info({
                    message: 'Invitation transaction: Payment is created sucessfully'
                });

                await this.ordersService._updateOrderStatus(
                    transactionManager,
                    _createdOrder.id,
                    OrderStatus.PLACED
                );

                return {
                    searchedUsers,
                    createdOrderId: _createdOrder.id,
                    team,
                    hostName: ensuredHostName
                };
            })),
            mergeMap(({
                searchedUsers,
                createdOrderId,
                team,
                hostName
            }) => {

                const invitedNewUsers = this.utilService.filterInvitedNewUsers(newInvitedNewMembers, searchedUsers);

                const signedUpUserInvitationNotifications$ = from(this.notificationsService.sendTeamInvitation(
                    team.name,
                    hostName,
                    searchedUsers as InvitedNewTeamMember[],
                    true
                ));

                const unsignedUserInvitationNotifications$ = from(this.notificationsService.sendTeamInvitation(
                    team.name,
                    hostName,
                    invitedNewUsers,
                    false
                ));

                const saveInvitedNewTeamMember$ = of(invitedNewUsers.length > 0)
                    .pipe(
                        filter(Boolean),
                        mergeMap(() => this.saveInvitedNewTeamMember(
                            teamId,
                            teamUUID,
                            invitedNewUsers,
                            createdOrderId
                        )),
                        defaultIfEmpty(true)
                    );

                return saveInvitedNewTeamMember$
                    .pipe(
                        mergeMap(() => merge(
                            signedUpUserInvitationNotifications$,
                            unsignedUserInvitationNotifications$
                        )),
                        toArray(),
                        map(() => true)
                    );
            })
        );
    }

    createInvitedProfiles(
        user: Pick<User, 'id' | 'email' | 'phone'>
    ): Observable<Profile[]> {
        return from(defer(() =>
            this.datasource.transaction(
                (transactionManager) =>
                    firstValueFrom(
                        this._createInvitedProfiles(transactionManager, user)
                    )
            ))
        );
    }

    _createInvitedProfiles(
        transactionManager: EntityManager,
        user: Pick<User, 'id' | 'email' | 'phone'>
    ): Observable<Profile[]> {

        const emailOrPhone = user.email || user.phone;
        const _profileRepository = transactionManager.getRepository(Profile);

        this.logger.info({
            message: 'Start to create the profiles with invitations in transaction',
            email: user.email,
            phone: user.phone
        });

        return from(this.profilesRedisRepository.getTeamInvitations(emailOrPhone as string))
            .pipe(
                tap((teamEntitiesAndOrderIds) => {
                    this.logger.info({
                        message: 'Loaded team entities and related orders',
                        teamEntitiesAndOrderIds
                    });
                })
            ).pipe(
                mergeMap((teamEntitiesAndOrderIds) => from(teamEntitiesAndOrderIds)),
                map((_team) => {

                    const createdProfile = this.profileRepository.create({
                        teamId: _team.id,
                        userId: user.id
                    });

                    createdProfile.teamUUID = _team.uuid;
                    createdProfile.orderId = _team.orderId;

                    return createdProfile;
                }),
                toArray(),
                tap((_newProfiles) => {
                    this.logger.info({
                        message: 'Trying to save the profiles with invitations in transaction',
                        invitationLength: _newProfiles.length,
                        email: user.email,
                        phone: user.phone
                    });
                }),
                mergeMap((_newProfiles) =>
                    from(defer(() =>
                        _profileRepository.save(_newProfiles)
                    ))
                ),
                tap((_savedProfiles) => {
                    this.logger.info({
                        message: 'creating the profiles is done. Trying to update the related order in transaction',
                        invitationLength: _savedProfiles.length,
                        email: user.email,
                        phone: user.phone
                    });
                }),
                mergeMap((profiles) => from(profiles)),
                mergeMap((_createdProfile) =>
                    this.ordersService.fetch({
                        id: _createdProfile.orderId
                    }).pipe(
                        tap((relatedOrder) => {
                            this.logger.info({
                                message: 'Loaded a related order in transaction',
                                relatedOrderId: relatedOrder.id,
                                email: user.email,
                                phone: user.phone
                            });
                        }),
                        mergeMap((relatedOrder) => this.ordersService._update(
                            transactionManager,
                            relatedOrder.id,
                            {
                                option: {
                                    profileIds: (relatedOrder.option?.profileIds || []).concat(_createdProfile.id)
                                }
                            }
                        )),
                        map(() => _createdProfile)
                    )
                ),
                toArray()
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

    saveInvitedNewTeamMember(
        teamId: number,
        teamUUID: string,
        invitedNewMembers: InvitedNewTeamMember[],
        orderId: number
    ): Observable<boolean> {
        return from(defer(() => this.profilesRedisRepository.setTeamInvitations(
            teamId,
            teamUUID,
            invitedNewMembers,
            orderId
        )));
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
        teamId: number,
        teamUUID: string,
        user: Pick<User, 'id' | 'email' | 'phone'>
    ): Observable<boolean> {
        return combineLatest([
            this.profilesRedisRepository.deleteTeamInvitations(teamId, teamUUID, user.email as string),
            this.profilesRedisRepository.deleteTeamInvitations(teamId, teamUUID, user.phone as string)
        ]).pipe(map(() => true));
    }

    /**
     * Member request is validated on validateProfileDeleteRequest
     * So, we should check target profile roles can be changed by requester
     *
     * @param teamId
     * @param profileId
     * @returns
     */
    remove(
        teamId: number,
        authProfile: Profile,
        profileId: number
    ): Observable<boolean> {

        const {
            id: authProfileId,
            roles: authRoles,
            name: canceler
        } = authProfile;

        // check profile roles and validate it.
        return from(defer(() => this.profileRepository.findOneByOrFail({
            id: profileId,
            teamId
        }))).pipe(
            tap((deleteTargetProfile) => {

                if (deleteTargetProfile.roles.includes(Role.OWNER)) {
                    throw new ForbiddenException('Owner cannot be deleted');
                } else if (
                    deleteTargetProfile.roles.includes(Role.MANAGER)
                    && authRoles.includes(Role.MANAGER)
                    && authProfileId !== profileId
                ) {
                    throw new ForbiddenException('Invalid permission request');
                }
            }),
            mergeMap((deleteTargetProfile) => combineLatest([
                of(deleteTargetProfile),
                this._fetchTeamOwnerProfile(teamId),
                this.teamService.get(teamId, authProfile.userId, {}),
                this.ordersService.fetch({
                    teamId,
                    orderOption: {
                        profileIds: [deleteTargetProfile.id]
                    }
                })
            ])),
            tap(([
                deleteTargetProfile,
                ownerProfile,
                loadedTeam,
                relatedOrder
            ]) => {
                this.logger.info({
                    message: 'Profile Remove: Start transaction',
                    relatedOrder,
                    loadedTeam,
                    deleteTargetProfile,
                    ownerProfile
                });
            }),
            mergeMap(([
                deleteTargetProfile,
                ownerProfile,
                loadedTeam,
                relatedOrder
            ]: [Profile, Profile, Team, Order]) => this.datasource.transaction(async (transactionManager) => {

                const unitPrice = Math.floor(relatedOrder.amount / relatedOrder.unit);
                const proration = this.utilService.getProratedPrice(
                    unitPrice,
                    loadedTeam.createdAt
                );
                const profileName = deleteTargetProfile.name || deleteTargetProfile.id;
                const refundMessage = `Profile ${profileName} is removed by ${canceler || authProfileId}`;

                const isPartialCancelation = relatedOrder.unit > 1;

                await this.paymentsService._refund(
                    transactionManager,
                    relatedOrder,
                    canceler as string,
                    refundMessage,
                    proration,
                    isPartialCancelation
                );

                const _profileRepository = transactionManager.getRepository(Profile);
                const _availabilityRepository = transactionManager.getRepository(Availability);

                await _availabilityRepository.softDelete({
                    profileId: deleteTargetProfile.id
                });

                await _availabilityRepository.update(
                    { profileId: deleteTargetProfile.id },
                    { profileId: ownerProfile.id }
                );

                const deleteResult = await _profileRepository.delete({
                    id: profileId,
                    teamId
                });

                return deleteResult;
            })),
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

    validateProfileDeleteRequest(
        authProfileId: number,
        profileId: number,
        roles: Role[]
    ): boolean {

        const isResignationSelf = authProfileId === profileId;

        if (isResignationSelf) {
            if (roles.includes(Role.OWNER)) {
                throw new ForbiddenException('Owner cannot remove himself');
            }
        } else {
            if (
                roles.includes(Role.OWNER) === false
                && roles.includes(Role.MANAGER) === false
            ) {
                throw new ForbiddenException('Only owner or manager can remove other profiles');
            }
        }

        return true;
    }
}
