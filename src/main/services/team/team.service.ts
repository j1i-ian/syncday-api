import { Inject, Injectable, forwardRef } from '@nestjs/common';
import {
    Observable,
    catchError,
    combineLatest,
    combineLatestWith,
    concat,
    concatMap,
    defaultIfEmpty,
    defer,
    filter,
    firstValueFrom,
    from,
    map,
    merge,
    mergeMap,
    of,
    reduce,
    tap,
    throwIfEmpty,
    toArray,
    zip
} from 'rxjs';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { OrderStatus } from '@interfaces/orders/order-status.enum';
import { ProfileStatus } from '@interfaces/profiles/profile-status.enum';
import { Role } from '@interfaces/profiles/role.enum';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { TeamPlanStatus } from '@interfaces/teams/team-plan-status.enum';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { ProductsService } from '@services/products/products.service';
import { OrdersService } from '@services/orders/orders.service';
import { PaymentsService } from '@services/payments/payments.service';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { UserService } from '@services/users/user.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { UtilService } from '@services/util/util.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { TeamRedisRepository } from '@services/team/team.redis-repository';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Team } from '@entity/teams/team.entity';
import { Product } from '@entity/products/product.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { EventGroup } from '@entity/events/event-group.entity';
import { Order } from '@entity/orders/order.entity';
import { Event } from '@entity/events/event.entity';
import { AlreadyUsedInWorkspace } from '@app/exceptions/users/already-used-in-workspace.exception';
import { CannotDeleteTeamException } from '@app/exceptions/teams/cannot-delete-team.exception';
import { InternalBootpayException } from '@exceptions/internal-bootpay.exception';
import { BootpayException } from '@exceptions/bootpay.exception';

@Injectable()
export class TeamService {

    constructor(
        private readonly utilService: UtilService,
        private readonly teamSettingService: TeamSettingService,
        private readonly productsService: ProductsService,
        private readonly ordersService: OrdersService,
        private readonly paymentMethodService: PaymentMethodService,
        private readonly paymentsService: PaymentsService,
        private readonly eventsService: EventsService,
        private readonly availabilityService: AvailabilityService,
        private readonly teamRedisRepository: TeamRedisRepository,
        private readonly eventRedisRepository: EventsRedisRepository,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        @Inject(forwardRef(() => ProfilesService))
        private readonly profilesService: ProfilesService,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        @Inject(forwardRef(() => NotificationsService))
        private readonly notificationsService: NotificationsService,
        @InjectDataSource() private readonly datasource: DataSource,
        @InjectRepository(Team) private readonly teamRepository: Repository<Team>
    ) {}

    search(userId: number): Observable<Team[]> {

        const teamQueryBuilder = this.teamRepository.createQueryBuilder('team');

        const patchedQueryBuilder = this.__getTeamOptionQuery(userId, teamQueryBuilder);

        return from(
            patchedQueryBuilder.getMany()
        ).pipe(
            mergeMap((teams) =>
                of(teams.map((_team) => _team.uuid))
                    .pipe(
                        concatMap((teamUUIDs) => zip([
                            from(this.teamRedisRepository.searchMemberCount(teamUUIDs)),
                            from(this.teamRedisRepository.searchTeamPlanStatus(teamUUIDs))
                        ])),
                        tap(([memberCountArray, teamPlanStatusArray]) => {
                            memberCountArray.forEach((_memberCount, index) => {

                                const teamPlanStatus = teamPlanStatusArray[index];

                                teams[index].plan = teamPlanStatus ?? TeamPlanStatus.FREE;
                                teams[index].memberCount = _memberCount ?? 0;
                            });

                            return teams;
                        }),
                        map(() => teams)
                    ))
        );
    }

    get(
        teamId: number,
        userId: number
    ): Observable<Team> {

        return of(this.teamRepository.createQueryBuilder('team'))
            .pipe(
                map((_teamQueryBuilder) => this.__getTeamOptionQuery(userId, _teamQueryBuilder)),
                tap((_patchedQueryBuilder) => {
                    _patchedQueryBuilder.andWhere('team.id = :teamId', { teamId });
                }),
                mergeMap((_patchedQueryBuilder) => from(
                    _patchedQueryBuilder.getOneOrFail())
                ),
                mergeMap((team) =>
                    zip([
                        this.teamRedisRepository.getMemberCount(team.uuid),
                        this.teamRedisRepository.getTeamPlanStatus(team.uuid)
                    ])
                        .pipe(
                            map(([memberCount, plan]) => {
                                team.memberCount = memberCount;
                                team.plan = plan;
                                return team;
                            }),
                            map(() => team)
                        )
                )
            );
    }

    findByWorkspace(
        teamWorkspace: string,
        eventUUID?: string | null
    ): Observable<Team> {

        const eventGroupFindWhereOption: FindOptionsWhere<Team> = eventUUID
            ? {
                eventGroups: {
                    events: {
                        uuid: eventUUID
                    }
                },
                profiles: {
                    eventProfiles: {
                        event: {
                            uuid: eventUUID
                        }
                    }
                }
            }
            : {};

        return from(
            this.teamRepository.findOneOrFail({
                where: {
                    teamSetting: {
                        workspace: teamWorkspace
                    },
                    ...eventGroupFindWhereOption
                },
                relations: {
                    teamSetting: true,
                    profiles: {
                        user: {
                            userSetting: true
                        },
                        availabilities: true
                    }
                }
            })
        );
    }

    /**
     * Create a team with associated payment information
     *
     * @param orderUnit
     * @param newPaymentMethod newPaymentMethod.teams are patched in create method
     * @param newTeam
     * @param newTeamSetting
     * @param teamMembers
     * @param ownerUserId
     * @returns
     */
    create(
        orderUnit: number,
        newPaymentMethod: Pick<PaymentMethod, 'creditCard'> & Partial<Pick<PaymentMethod, 'teams'>>,
        newTeam: Partial<Team>,
        newTeamSetting: Pick<TeamSetting, 'workspace' | 'greetings'>,
        teamMembers: InvitedNewTeamMember[],
        orderer: Orderer,
        ownerUserId: number
    ): Observable<Team> {

        const checkAlreadyUsedWorkspaceIn$ = from(
            this.teamSettingService.fetchTeamWorkspaceStatus(
                newTeamSetting.workspace
            )
        ).pipe(
            tap((isAlreadyUsedIn) => {
                if (isAlreadyUsedIn) {
                    throw new AlreadyUsedInWorkspace();
                }
            })
        );

        const allMemberEmails = teamMembers
            .filter((_member) => _member.email)
            .map((_member) => _member.email as string);

        const allMemberPhones = teamMembers
            .filter((_member) => _member.phone)
            .map((_member) => _member.phone as string);

        return checkAlreadyUsedWorkspaceIn$.pipe(
            mergeMap(() => combineLatest([
                // product id 1 is Team Plan Product
                this.productsService.findTeamPlanProduct(1),
                this.userService.search({ emails: allMemberEmails, phones: allMemberPhones }),
                this.userService.findUser({ userId: ownerUserId })
            ])),
            mergeMap(([loadedProduct, searchedUsers, owner]: [Product, User[], User]) =>
                this.datasource.transaction(async (transactionManager) => {

                    this.logger.info({
                        message: 'Create a new team',
                        memberLength: teamMembers.length,
                        owner: owner.email || owner.phone,
                        searchedUsersLength: searchedUsers.length
                    });

                    const _createdTeam = await this._create(
                        transactionManager,
                        newTeam,
                        newTeamSetting
                    );

                    newPaymentMethod.teams = [{ id: _createdTeam.id } as Team];

                    const _buyer = {
                        name: _createdTeam.name,
                        email: owner.email,
                        phone: owner.phone
                    } as Buyer;

                    const proration = loadedProduct.price;

                    this.logger.info({
                        message: 'New team is created. Trying to create an order',
                        productId: loadedProduct.id,
                        orderUnit,
                        createdTeamId: _createdTeam.id,
                        proration
                    });

                    const _createdOrder = await this.ordersService._create(
                        transactionManager,
                        loadedProduct,
                        orderUnit,
                        { teamId: _createdTeam.id },
                        _createdTeam.id,
                        proration,
                        orderer
                    );

                    const _createdPaymentMethod = await this.paymentMethodService._create(
                        transactionManager,
                        newPaymentMethod,
                        _buyer,
                        _createdOrder.uuid
                    );

                    await this.paymentsService._create(
                        transactionManager,
                        proration,
                        _createdOrder,
                        _createdPaymentMethod,
                        _buyer
                    );

                    await this.ordersService._updateOrderStatus(
                        transactionManager,
                        _createdOrder.id,
                        OrderStatus.PLACED
                    );

                    const allUsers = [owner].concat(searchedUsers);
                    const _profiles = allUsers.map((_user) => {

                        const isOwnerProfile = owner.id === _user.id;

                        const _createdProfile = this.utilService.createNewProfile(
                            _createdTeam.id,
                            _user.id
                        );

                        _createdProfile.user = _user;

                        if (isOwnerProfile) {
                            _createdProfile.status = ProfileStatus.ACTIVATED;
                            _createdProfile.roles = [Role.OWNER];
                        }

                        return _createdProfile;
                    });

                    this.logger.info({
                        message: 'Creating profiles from member list',
                        createdProfilesLength: _profiles.length
                    });

                    const savedProfiles = await this.profilesService._create(transactionManager, _profiles) as Profile[];

                    const patchedProfiles = await Promise.all(savedProfiles.map(async (_savedProfile) => {

                        const profileMember = _savedProfile.user;

                        const _userSetting = profileMember.userSetting;
                        const { preferredLanguage, preferredTimezone } = _userSetting;
                        const defaultAvailability = this.utilService.getDefaultAvailability(preferredLanguage, preferredTimezone);

                        const savedAvailability = await this.availabilityService._create(
                            transactionManager,
                            _createdTeam.uuid,
                            _savedProfile.id,
                            defaultAvailability,
                            {
                                default: true
                            }
                        );

                        _savedProfile.availabilities = [savedAvailability];

                        return _savedProfile;
                    }));

                    _createdTeam.profiles = patchedProfiles;

                    this.logger.info({
                        message: 'Profiles are created successfully. Trying to create an event group',
                        patchedProfilesLength: patchedProfiles.length
                    });

                    const _createdRootProfile = patchedProfiles.find((_profile) => _profile.userId === owner.id) as Profile;

                    const ownerDefaultAvailability = _createdRootProfile.availabilities[0];

                    // create a default event group
                    const eventGroupRepository = transactionManager.getRepository(EventGroup);

                    const initialEventGroup = new EventGroup();
                    initialEventGroup.teamId = _createdTeam.id;

                    const savedEventGroup = await eventGroupRepository.save(initialEventGroup);

                    this.logger.info({
                        message: 'EventGroup is created. Trying to create an event.',
                        createdTeamId: _createdTeam.id,
                        createdTeamUUID: _createdTeam.uuid,
                        createdRootProfileId: _createdRootProfile.id,
                        ownerDefaultAvailabilityId: ownerDefaultAvailability.id
                    });

                    // set event group setting
                    const initialEventGroupSetting = this.utilService.getInitialEventGroupSetting({
                        hasPhoneNotification: true
                    });

                    await firstValueFrom(
                        this.eventRedisRepository.setEventGroupSetting(
                            savedEventGroup.uuid,
                            initialEventGroupSetting
                        )
                    );

                    await this.eventsService._create(
                        transactionManager,
                        _createdTeam.uuid,
                        _createdRootProfile.id,
                        ownerDefaultAvailability.id,
                        { eventGroupId: savedEventGroup.id } as Event,
                        savedEventGroup.uuid
                    );

                    this.logger.info({
                        message: 'Creating an event is success. Close transaction.',
                        createdTeamId: _createdTeam.id,
                        createdTeamUUID: _createdTeam.uuid,
                        createdRootProfileId: _createdRootProfile.id,
                        ownerDefaultAvailabilityId: ownerDefaultAvailability.id
                    });

                    await this.teamRedisRepository.initializeMemberCount(_createdTeam.uuid, teamMembers.length);

                    await this.teamRedisRepository.setTeamPlanStatus(_createdTeam.uuid, TeamPlanStatus.PRO);

                    return {
                        createdTeam: _createdTeam,
                        searchedUsers,
                        createdOrder: _createdOrder
                    };
                })
            ),
            mergeMap(({
                createdTeam,
                searchedUsers,
                createdOrder
            }) => {

                const hostName = createdTeam.name;
                const invitedNewUsers = this.utilService.filterInvitedNewUsers(teamMembers, searchedUsers);

                const signedUpUserInvitationNotifications$ = defer(() => from(this.notificationsService.sendTeamInvitation(
                    createdTeam.name,
                    hostName,
                    searchedUsers as InvitedNewTeamMember[],
                    true
                )));

                const saveInvitedNewTeamMember$ = of(invitedNewUsers.length > 0)
                    .pipe(
                        filter(Boolean),
                        mergeMap(() => this.profilesService.saveInvitedNewTeamMember(
                            createdTeam.id,
                            createdTeam.uuid,
                            invitedNewUsers,
                            createdOrder.id
                        )),
                        defaultIfEmpty(true)
                    );

                const unsignedUserInvitationNotifications$ = defer(() => from(this.notificationsService.sendTeamInvitation(
                    createdTeam.name,
                    hostName,
                    invitedNewUsers,
                    false
                )));

                return saveInvitedNewTeamMember$
                    .pipe(
                        mergeMap(() => merge(
                            signedUpUserInvitationNotifications$,
                            unsignedUserInvitationNotifications$
                        )),
                        toArray(),
                        map(() => createdTeam)
                    );
            })
        );
    }

    async _create(
        manager: EntityManager,
        newTeam: Partial<Team>,
        newTeamSetting: Partial<TeamSetting> & Pick<TeamSetting, 'workspace'>
    ): Promise<Team> {

        const teamRepository = manager.getRepository(Team);

        const createdTeam = teamRepository.create(newTeam);

        createdTeam.teamSetting = newTeamSetting as TeamSetting;

        const savedTeam = await teamRepository.save(createdTeam);
        const workspace = newTeamSetting.workspace;

        this.logger.info({
            message: 'Trying to update a team workspace',
            savedTeamId: savedTeam.id,
            workspace
        });

        await this.teamSettingService._updateTeamWorkspace(
            manager,
            savedTeam.id,
            null,
            workspace
        );

        this.logger.info({
            message: 'Team workspace updating is done',
            savedTeamId: savedTeam.id,
            workspace
        });

        return savedTeam;
    }

    patch(
        teamId: number,
        patchTeamRequestDto: Pick<Team, 'name' | 'logo'>
    ): Observable<boolean> {
        return from(
            this.teamRepository.update(
                { id: teamId },
                {
                    name: patchTeamRequestDto.name,
                    logo: patchTeamRequestDto.logo
                }
            )
        ).pipe(
            map((updateResult) => !!(updateResult &&
                updateResult.affected &&
                updateResult.affected > 0))
        );
    }

    delete(authProfile: AppJwtPayload): Observable<boolean> {

        const { id, teamId, teamUUID, name } = authProfile;

        const validateProfiles$ = this.profilesService.search({
            teamId
        }).pipe(
            map((profiles) => profiles.length > 1),
            tap((hasProfiles) => {
                if (hasProfiles) {
                    throw new CannotDeleteTeamException('Team should have not the profiles for delete request');
                }
            })
        );
        const validateInvitations$ = this.profilesService.searchInvitations(teamUUID)
            .pipe(
                map((invitations) => invitations.length > 0),
                tap((hasInvitations) => {
                    if (hasInvitations) {
                        throw new CannotDeleteTeamException('Team should have not the invitations for delete request');
                    }
                }));

        const team$ = defer(() => from(this.teamRepository.findOneByOrFail({ id: teamId })));

        const refundParams$ = this.ordersService.fetch({
            teamId,
            orderOption: {
                teamId
            }
        })
            .pipe(
                filter((relatedOrder) => relatedOrder !== null),
                map((relatedOrder) => relatedOrder as Order),
                combineLatestWith(team$),
                tap(([loadedOrder, loadedTeam]) => {
                    this.logger.info({
                        message: 'Team Delete is requested.. Refund with proration',
                        authProfile,
                        loadedOrder,
                        loadedTeam
                    });
                }),
                mergeMap(([relatedOrder, loadedTeam]) => of({
                    unitPrice: Math.floor(relatedOrder.amount / relatedOrder.unit),
                    isPartialCancelation: relatedOrder.unit > 1,
                    profileName: name || id,
                    refundMessage: `Team ${loadedTeam.name} is removed by owner ${name}`,
                    teamCreatedAt: loadedTeam.createdAt,
                    relatedOrder
                })),
                map((refundParams) => {
                    const { unitPrice  } = refundParams;
                    const refundProration = this.utilService.getProration(unitPrice, refundParams.teamCreatedAt);

                    return {
                        ...refundParams,
                        refundProration
                    };
                })
            );

        const refund$ = refundParams$.pipe(
            filter(({ relatedOrder}) => relatedOrder !== null),
            mergeMap(({
                refundProration,
                profileName,
                refundMessage,
                isPartialCancelation,
                relatedOrder
            }) => this.paymentsService._refund(
                relatedOrder,
                profileName as string,
                refundMessage,
                refundProration,
                isPartialCancelation
            )),
            defaultIfEmpty(true)
        );

        return zip(
            validateProfiles$,
            validateInvitations$
        ).pipe(
            mergeMap(() => refund$),
            catchError((error) => {

                this.logger.error({
                    message: 'Error while refunding the order',
                    authProfileId: authProfile.id,
                    error
                });

                return of(error)
                    .pipe(
                        filter((error) => error.error_code && error.message),
                        map((bootpayError: InternalBootpayException) => this.utilService.convertToBootpayException(bootpayError)),
                        throwIfEmpty(() => error)
                    );
            }),
            mergeMap((exception) =>
                from(this.datasource.transaction((transactionManager) =>
                    firstValueFrom(
                        concat(
                            this.teamSettingService._delete(
                                transactionManager,
                                teamId
                            ),
                            this._delete(transactionManager, teamId)
                        ).pipe(
                            reduce((acc, curr) => acc && curr),
                            mergeMap(() => refundParams$),
                            filter(({ relatedOrder}) => relatedOrder !== null),
                            mergeMap(({
                                relatedOrder,
                                refundProration
                            }) =>
                                this.paymentsService._save(
                                    transactionManager,
                                    relatedOrder,
                                    refundProration
                                )
                            ),
                            map(() => true),
                            defaultIfEmpty(true)
                        )
                    )
                )).pipe(
                    tap(() => {
                        if (exception instanceof BootpayException) {
                            throw exception;
                        }
                    })
                )
            ),
            map(() => true)
        );
    }

    _delete(transactionManager: EntityManager, teamId: number): Observable<boolean> {

        const teamDelete$ = of(transactionManager.getRepository(Team))
            .pipe(mergeMap((teamRepository) => teamRepository.softDelete(teamId)));
        const profileDelete$ = of(transactionManager.getRepository(Profile))
            .pipe(mergeMap((profileRepository) => profileRepository.softDelete({
                teamId
            })));

        return concat(teamDelete$, profileDelete$)
            .pipe(
                map((deleteResult) => !!(deleteResult &&
                    deleteResult.affected &&
                    deleteResult.affected > 0)),
                reduce((acc, curr) => acc && curr)
            );
    }

    __getTeamOptionQuery(
        userId: number,
        teamQueryBuilder: SelectQueryBuilder<Team>
    ): SelectQueryBuilder<Team> {

        if (userId) {
            teamQueryBuilder
                .leftJoin('team.profiles', 'profile')
                .leftJoinAndSelect('team.teamSetting', 'teamSetting')
                .where('profile.userId = :userId', {
                    userId
                });
        }

        return teamQueryBuilder;
    }
}
