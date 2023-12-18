import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Observable, combineLatest, from, map, mergeMap } from 'rxjs';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { OrderStatus } from '@interfaces/orders/order-status.enum';
import { ProfileStatus } from '@interfaces/profiles/profile-status.enum';
import { Role } from '@interfaces/profiles/role.enum';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { ProductsService } from '@services/products/products.service';
import { OrdersService } from '@services/orders/orders.service';
import { PaymentsService } from '@services/payments/payments.service';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { UserService } from '@services/users/user.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { UtilService } from '@services/util/util.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Team } from '@entity/teams/team.entity';
import { Order } from '@entity/orders/order.entity';
import { Product } from '@entity/products/product.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';

@Injectable()
export class TeamService {

    constructor(
        private readonly utilService: UtilService,
        private readonly teamSettingService: TeamSettingService,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        private readonly profilesService: ProfilesService,
        private readonly productsService: ProductsService,
        private readonly ordersService: OrdersService,
        private readonly paymentMethodService: PaymentMethodService,
        private readonly paymentsService: PaymentsService,
        @Inject(forwardRef(() => NotificationsService))
        private readonly notificationsService: NotificationsService,
        @InjectDataSource() private readonly datasource: DataSource,
        @InjectRepository(Team) private readonly teamRepository: Repository<Team>
    ) {}

    search(userId: number): Observable<Team[]> {
        return from(
            this.teamRepository.find({
                where: {
                    profiles: {
                        userId
                    }
                },
                relations: ['teamSetting']
            })
        );
    }

    get(teamId: number): Observable<Team> {
        return from(
            this.teamRepository.findOneByOrFail({
                id: teamId
            })
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
                relations: ['teamSetting', 'profiles', 'profiles.user']
            })
        );
    }

    create(
        newOrder: Partial<Order> & Pick<Order, 'unit' | 'price'>,
        newPaymentMethod: Pick<PaymentMethod, 'creditCard'> & Partial<Pick<PaymentMethod, 'teamId'>>,
        newTeam: Partial<Team>,
        newTeamSetting: Pick<TeamSetting, 'workspace' | 'greetings'>,
        teamMembers: Array<Partial<Pick<User, 'phone' | 'email'>>>,
        ownerUserId: number
    ): Observable<Team> {

        return combineLatest([
            this.productsService.findTeamPlanProduct(1),
            this.userService.searchByEmailOrPhone(teamMembers),
            this.userService.findUserById(ownerUserId)
        ]).pipe(
            mergeMap(([loadedProduct, searchedUsers, owner]: [Product, User[], User]) =>
                this.datasource.transaction(async (transactionManager) => {

                    const _createdTeam = await this._create(
                        transactionManager,
                        newTeam,
                        newTeamSetting
                    );

                    newPaymentMethod.teamId = _createdTeam.id;

                    const _buyer = {
                        name: _createdTeam.name,
                        email: owner.email,
                        phone: owner.phone
                    } as Buyer;

                    const _createdOrder = await this.ordersService._create(
                        transactionManager,
                        loadedProduct,
                        newOrder.unit,
                        _createdTeam.id
                    );

                    const _createdPaymentMethod = await this.paymentMethodService._create(
                        transactionManager,
                        newPaymentMethod,
                        _buyer,
                        _createdOrder.uuid
                    );

                    await this.paymentsService._create(
                        transactionManager,
                        _createdOrder,
                        _createdPaymentMethod,
                        _buyer
                    );

                    await this.ordersService._updateOrderStatus(
                        transactionManager,
                        _createdOrder.id,
                        OrderStatus.PLACED
                    );

                    const _createdProfiles = searchedUsers.map((_user) => ({
                        teamId: _createdTeam.id,
                        userId: _user.id
                    } as Partial<Profile>));
                    const _rootProfile = {
                        status: ProfileStatus.ACTIVATED,
                        roles: [Role.OWNER],
                        teamId: _createdTeam.id,
                        userId: owner.id
                    } as Profile;

                    const _allProfiles = _createdProfiles.concat(_rootProfile);

                    const savedProfiles = await this.profilesService._create(transactionManager, _allProfiles) as Profile[];

                    _createdTeam.profiles = savedProfiles;

                    return [_createdTeam, searchedUsers] as [Team, User[]];
                })
            ),
            mergeMap(([createdTeam, searchedUsers]: [Team, User[]]) => {

                const invitedNewUsers = this.utilService.filterInvitedNewUsers(teamMembers, searchedUsers);

                return this.notificationsService.sendTeamInvitationForNewUsers(invitedNewUsers)
                    .pipe(map(() => createdTeam));
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
        patchTeamRequestDto: Pick<Team, 'name' | 'avatar'>
    ): Observable<boolean> {
        return from(
            this.teamRepository.update(
                { id: teamId },
                {
                    name: patchTeamRequestDto.name,
                    avatar: patchTeamRequestDto.avatar
                }
            )
        ).pipe(
            map((updateResult) => !!(updateResult &&
                updateResult.affected &&
                updateResult.affected > 0))
        );
    }
}
