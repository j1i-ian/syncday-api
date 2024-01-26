import { Inject, Injectable, forwardRef } from '@nestjs/common';
import {
    Observable,
    catchError,
    combineLatest,
    combineLatestWith,
    concat,
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
import { DataSource, EntityManager, Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Buyer } from '@interfaces/payments/buyer.interface';
import { OrderStatus } from '@interfaces/orders/order-status.enum';
import { ProfileStatus } from '@interfaces/profiles/profile-status.enum';
import { Role } from '@interfaces/profiles/role.enum';
import { TeamSearchOption } from '@interfaces/teams/team-search-option.interface';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { TeamSettingService } from '@services/teams/team-setting/team-setting.service';
import { ProductsService } from '@services/products/products.service';
import { OrdersService } from '@services/orders/orders.service';
import { PaymentsService } from '@services/payments/payments.service';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { UserService } from '@services/users/user.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { UtilService } from '@services/utils/util.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { EventsService } from '@services/events/events.service';
import { TimeUtilService } from '@services/utils/time-util.service';
import { AvailabilityService } from '@services/availabilities/availability.service';
import { TeamSetting } from '@entities/teams/team-setting.entity';
import { Team } from '@entities/teams/team.entity';
import { Product } from '@entities/products/product.entity';
import { PaymentMethod } from '@entities/payments/payment-method.entity';
import { User } from '@entities/users/user.entity';
import { Profile } from '@entities/profiles/profile.entity';
import { EventGroup } from '@entities/events/event-group.entity';
import { AvailableTime } from '@entities/availability/availability-time.entity';
import { Order } from '@entities/orders/order.entity';
import { AlreadyUsedInWorkspace } from '@exceptions/users/already-used-in-workspace.exception';
import { CannotDeleteTeamException } from '@exceptions/teams/cannot-delete-team.exception';
import { InternalBootpayException } from '@exceptions/internal-bootpay.exception';
import { BootpayException } from '@exceptions/bootpay.exception';

@Injectable()
export class TeamService {

    constructor(
        private readonly utilService: UtilService,
        private readonly timeUtilService: TimeUtilService,
        private readonly teamSettingService: TeamSettingService,
        private readonly productsService: ProductsService,
        private readonly ordersService: OrdersService,
        private readonly paymentMethodService: PaymentMethodService,
        private readonly paymentsService: PaymentsService,
        private readonly eventsService: EventsService,
        private readonly availabilityService: AvailabilityService,
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

    search(userId: number, option: Partial<TeamSearchOption>): Observable<Team[]> {

        const teamQueryBuilder = this.teamRepository.createQueryBuilder('team');

        const patchedQueryBuilder = this.__getTeamOptionQuery(option, userId, teamQueryBuilder);

        return from(
            patchedQueryBuilder.getMany()
        );
    }

    get(
        teamId: number,
        userId: number,
        option: Partial<TeamSearchOption>
    ): Observable<Team> {

        const teamQueryBuilder = this.teamRepository.createQueryBuilder('team');

        const patchedQueryBuilder = this.__getTeamOptionQuery(option, userId, teamQueryBuilder);

        patchedQueryBuilder.andWhere('team.id = :teamId', { teamId });

        return from(
            defer(() => patchedQueryBuilder.getOneOrFail())
        );
    }

    findByWorkspace(teamWorkspace: string): Observable<Team> {
        return from(
            this.teamRepository.findOneOrFail({
                where: {
                    teamSetting: {
                        workspace: teamWorkspace
                    }
                },
                relations: {
                    teamSetting: true,
                    profiles: {
                        user: {
                            userSetting: true
                        }
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

                    const proration = 0;

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

                    const _createdProfiles = searchedUsers.map((_user) => this.utilService.createNewProfile(_createdTeam.id, _user.id));

                    const _rootProfile = {
                        status: ProfileStatus.ACTIVATED,
                        roles: [Role.OWNER],
                        teamId: _createdTeam.id,
                        userId: owner.id
                    } as Profile;

                    const _allProfiles = _createdProfiles.concat(_rootProfile);

                    const savedProfiles = await this.profilesService._create(transactionManager, _allProfiles) as Profile[];

                    _createdTeam.profiles = savedProfiles;

                    const ownerSetting = owner.userSetting;
                    const _createdRootProfile = savedProfiles.find((_profile) => _profile.roles.includes(Role.OWNER)) as Profile;

                    const defaultAvailableTimes: AvailableTime[] = this.timeUtilService.getDefaultAvailableTimes();

                    const availabilityDefaultName = this.utilService.getDefaultAvailabilityName(ownerSetting.preferredLanguage);

                    const savedAvailability = await this.availabilityService._create(
                        transactionManager,
                        _createdTeam.uuid,
                        _createdRootProfile.id,
                        {
                            availableTimes: defaultAvailableTimes,
                            name: availabilityDefaultName,
                            overrides: [],
                            timezone: ownerSetting.preferredTimezone
                        },
                        {
                            default: true
                        }
                    );

                    // create a default event group
                    const eventGroupRepository = transactionManager.getRepository(EventGroup);

                    const initialEventGroup = new EventGroup();
                    initialEventGroup.teamId = _createdTeam.id;

                    const savedEventGroup = await eventGroupRepository.save(initialEventGroup);

                    // create a default event
                    const initialEvent = this.utilService.getDefaultEvent({
                        name: '30 Minute Meeting',
                        link: '30-minute-meeting',
                        eventGroupId: savedEventGroup.id
                    });
                    initialEvent.availabilityId = savedAvailability.id;

                    await this.eventsService._create(
                        transactionManager,
                        _createdTeam.uuid,
                        initialEvent
                    );

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

                const signedUpUserInvitationNotifications$ = from(this.notificationsService.sendTeamInvitation(
                    createdTeam.name,
                    hostName,
                    searchedUsers as InvitedNewTeamMember[],
                    true
                ));

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

                const unsignedUserInvitationNotifications$ = from(this.notificationsService.sendTeamInvitation(
                    createdTeam.name,
                    hostName,
                    invitedNewUsers,
                    false
                ));

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

        await this.teamSettingService._updateTeamWorkspace(
            manager,
            savedTeam.id,
            null,
            workspace
        );

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
        const validateInvitations$ = from(this.profilesService.searchInvitations(teamUUID))
            .pipe(
                map((invitations) => invitations.length > 0),
                tap((hasInvitations) => {
                    if (hasInvitations) {
                        throw new CannotDeleteTeamException('Team should have not the invitations for delete request');
                    }
                }));

        const team$ = from(defer(() => this.teamRepository.findOneByOrFail({ id: teamId })));

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
                    const proratedRefundUnitPrice = this.utilService.getProratedPrice(unitPrice, refundParams.teamCreatedAt);

                    return {
                        ...refundParams,
                        proratedRefundUnitPrice
                    };
                })
            );

        const refund$ = refundParams$.pipe(
            filter(({ relatedOrder}) => relatedOrder !== null),
            mergeMap(({
                proratedRefundUnitPrice,
                profileName,
                refundMessage,
                isPartialCancelation,
                relatedOrder
            }) => this.paymentsService._refund(
                relatedOrder,
                profileName as string,
                refundMessage,
                proratedRefundUnitPrice,
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
                                proratedRefundUnitPrice
                            }) =>
                                this.paymentsService._save(
                                    transactionManager,
                                    relatedOrder,
                                    proratedRefundUnitPrice
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
        option: Partial<TeamSearchOption>,
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

        if (option.withMemberCounts) {
            teamQueryBuilder
                .loadRelationCountAndMap('team.memberCount', 'team.profiles');
        }

        return teamQueryBuilder;
    }
}
