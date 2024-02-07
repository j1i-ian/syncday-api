import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { firstValueFrom, of } from 'rxjs';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { stubQueryBuilder } from 'typeorm-faker';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Role } from '@interfaces/profiles/role.enum';
import { TeamSearchOption } from '@interfaces/teams/team-search-option.interface';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { UserService } from '@services/users/user.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { ProductsService } from '@services/products/products.service';
import { OrdersService } from '@services/orders/orders.service';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { PaymentsService } from '@services/payments/payments.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { Team } from '@entity/teams/team.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { User } from '@entity/users/user.entity';
import { Product } from '@entity/products/product.entity';
import { Order } from '@entity/orders/order.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { Payment } from '@entity/payments/payment.entity';
import { Availability } from '@entity/availability/availability.entity';
import { EventGroup } from '@entity/events/event-group.entity';
import { Event } from '@entity/events/event.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { AlreadyUsedInWorkspace } from '@app/exceptions/users/already-used-in-workspace.exception';
import { CannotDeleteTeamException } from '@app/exceptions/teams/cannot-delete-team.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { TeamService } from './team.service';

const testMockUtil = new TestMockUtil();

describe('TeamService', () => {
    let service: TeamService;

    let module: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let teamSettingServiceStub: sinon.SinonStubbedInstance<TeamSettingService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let profilesServiceStub: sinon.SinonStubbedInstance<ProfilesService>;
    let productsServiceStub: sinon.SinonStubbedInstance<ProductsService>;
    let ordersServiceStub: sinon.SinonStubbedInstance<OrdersService>;
    let paymentMethodServiceStub: sinon.SinonStubbedInstance<PaymentMethodService>;
    let paymentsServiceStub: sinon.SinonStubbedInstance<PaymentsService>;
    let timeUtilServiceStub: sinon.SinonStubbedInstance<TimeUtilService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let notificationsStub: sinon.SinonStubbedInstance<NotificationsService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let availabilityServiceStub: sinon.SinonStubbedInstance<AvailabilityService>;

    let teamRepositoryStub: sinon.SinonStubbedInstance<Repository<Team>>;
    let eventGroupRepositoryStub: sinon.SinonStubbedInstance<Repository<EventGroup>>;

    before(async () => {

        teamSettingServiceStub = sinon.createStubInstance(TeamSettingService);
        userServiceStub = sinon.createStubInstance(UserService);
        profilesServiceStub = sinon.createStubInstance(ProfilesService);
        productsServiceStub = sinon.createStubInstance(ProductsService);
        ordersServiceStub = sinon.createStubInstance(OrdersService);
        paymentMethodServiceStub = sinon.createStubInstance(PaymentMethodService);
        paymentsServiceStub = sinon.createStubInstance(PaymentsService);
        timeUtilServiceStub = sinon.createStubInstance(TimeUtilService);
        utilServiceStub = sinon.createStubInstance(UtilService);
        notificationsStub = sinon.createStubInstance(NotificationsService);
        eventsServiceStub = sinon.createStubInstance(EventsService);
        availabilityServiceStub = sinon.createStubInstance(AvailabilityService);

        teamRepositoryStub = sinon.createStubInstance<Repository<Team>>(Repository);
        eventGroupRepositoryStub = sinon.createStubInstance<Repository<EventGroup>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                TeamService,
                {
                    provide: TeamSettingService,
                    useValue: teamSettingServiceStub
                },
                {
                    provide: ProductsService,
                    useValue: productsServiceStub
                },
                {
                    provide: UserService,
                    useValue: userServiceStub
                },
                {
                    provide: PaymentMethodService,
                    useValue: paymentMethodServiceStub
                },
                {
                    provide: OrdersService,
                    useValue: ordersServiceStub
                },
                {
                    provide: PaymentsService,
                    useValue: paymentsServiceStub
                },
                {
                    provide: ProfilesService,
                    useValue: profilesServiceStub
                },
                {
                    provide: TimeUtilService,
                    useValue: timeUtilServiceStub
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: NotificationsService,
                    useValue: notificationsStub
                },
                {
                    provide: EventsService,
                    useValue: eventsServiceStub
                },
                {
                    provide: AvailabilityService,
                    useValue: availabilityServiceStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(Team),
                    useValue: teamRepositoryStub
                },
                {
                    provide: getRepositoryToken(EventGroup),
                    useValue: eventGroupRepositoryStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: TestMockUtil.getLoggerStub()
                }
            ]
        }).compile();

        service = module.get<TeamService>(TeamService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test team finding', () => {
        let serviceSandbox: sinon.SinonSandbox;

        let teamQueryBuilderStub: SinonStubbedInstance<SelectQueryBuilder<Team>>;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
            const teamsStub = stub(Team);

            teamQueryBuilderStub = stubQueryBuilder(
                serviceSandbox,
                Team,
                teamsStub
            );
        });

        afterEach(() => {
            teamRepositoryStub.findOneOrFail.reset();
            teamRepositoryStub.findOneBy.reset();

            teamQueryBuilderStub.getMany.reset();

            serviceSandbox.restore();
        });

        it('should be searched teams by profile id', async () => {
            const userIdMock = stubOne(User).id;
            const optionMock = {} as TeamSearchOption;

            serviceSandbox.stub(service, '__getTeamOptionQuery')
                .returns(teamQueryBuilderStub);

            const loadedTeams = await firstValueFrom(service.search(userIdMock, optionMock));
            expect(loadedTeams).ok;
            expect(loadedTeams.length).greaterThan(0);

            expect(teamQueryBuilderStub.getMany.called).true;
        });

        it('should be got a team by team workspace', async () => {
            const teamStub = stubOne(Team);

            teamRepositoryStub.findOneOrFail.resolves(teamStub);

            const loadedTeam = await firstValueFrom(service.findByWorkspace(teamStub.workspace as string));

            const actualPassedParam = teamRepositoryStub.findOneOrFail.getCall(0).args[0];
            expect(
                (
                    (actualPassedParam.where as FindOptionsWhere<Team>)
                        .teamSetting as FindOptionsWhere<TeamSetting>
                ).workspace
            ).equals(teamStub.workspace);

            expect(loadedTeam).equal(teamStub);
        });
    });

    describe('Test team fetching', () => {
        let serviceSandbox: sinon.SinonSandbox;

        let teamQueryBuilderStub: SinonStubbedInstance<SelectQueryBuilder<Team>>;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
            const teamsStub = stub(Team);

            teamQueryBuilderStub = stubQueryBuilder(
                serviceSandbox,
                Team,
                teamsStub
            );
        });

        afterEach(() => {
            teamRepositoryStub.createQueryBuilder.reset();

            teamQueryBuilderStub.andWhere.reset();
            teamQueryBuilderStub.getOneOrFail.reset();

            serviceSandbox.restore();
        });

        it('should be fetched a team with option', async () => {
            const teamStub = stubOne(Team, {
                memberCount: 12121
            });
            const invitationCountStub = 8282;

            const expectedMemberCount = teamStub.memberCount + invitationCountStub;

            const userIdMock = stubOne(User).id;

            profilesServiceStub.countTeamInvitations.resolves(invitationCountStub);

            serviceSandbox.stub(service, '__getTeamOptionQuery')
                .returns(teamQueryBuilderStub);

            teamQueryBuilderStub.getOneOrFail.resolves(teamStub);

            const teamIdMock = teamStub.id;
            const teamUUIDMock = teamStub.uuid;

            const fetchedTeam = await firstValueFrom(
                service.get(
                    teamIdMock,
                    userIdMock,
                    {
                        withMemberCounts: true,
                        teamUUID: teamUUIDMock
                    }
                )
            );

            expect(fetchedTeam).ok;
            expect(fetchedTeam.memberCount).equals(expectedMemberCount);

            expect(profilesServiceStub.countTeamInvitations.called).true;
            expect(teamRepositoryStub.createQueryBuilder.called).true;
            expect(teamQueryBuilderStub.andWhere.called).true;
            expect(teamQueryBuilderStub.getOneOrFail.called).true;
        });
    });

    describe('Test team creating', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {

            teamRepositoryStub.create.reset();
            teamRepositoryStub.save.reset();
            teamSettingServiceStub._updateTeamWorkspace.reset();

            teamSettingServiceStub.fetchTeamWorkspaceStatus.reset();
            productsServiceStub.findTeamPlanProduct.reset();
            userServiceStub.search.reset();
            paymentMethodServiceStub._create.reset();
            ordersServiceStub._create.reset();
            paymentsServiceStub._create.reset();
            ordersServiceStub._updateOrderStatus.reset();
            utilServiceStub.createNewProfile.reset();
            profilesServiceStub._create.reset();
            profilesServiceStub.saveInvitedNewTeamMember.reset();

            utilServiceStub.getDefaultAvailability.reset();
            availabilityServiceStub._create.reset();
            eventGroupRepositoryStub.save.reset();
            utilServiceStub.getDefaultEvent.reset();
            eventsServiceStub._create.reset();

            utilServiceStub.filterInvitedNewUsers.reset();
            notificationsStub.sendTeamInvitation.reset();

            teamRepositoryStub.create.reset();
            teamRepositoryStub.save.reset();

            serviceSandbox.restore();
        });

        it('should be created a team with order, payment method, invitations', async () => {

            const ownerUserSettingStub = stubOne(UserSetting);
            const ownerUserMockStub = stubOne(User, {
                userSetting: ownerUserSettingStub
            });
            const productStub = stubOne(Product);
            const searchedTeamMemberMocksStubs = stub(User, 5, {
                userSetting: stubOne(UserSetting)
            });

            const teamMockStub = stubOne(Team);
            const paymentMethodMockStub = stubOne(PaymentMethod);
            const orderMockStub = stubOne(Order);
            const paymentStub = stubOne(Payment);

            const profileStubs = stub(Profile);
            profileStubs[0].roles = [Role.OWNER];
            profileStubs[0].userId = ownerUserMockStub.id;

            const teamSettingMock = stubOne(TeamSetting);

            const availabilityStub = stubOne(Availability);
            const eventGroupStub = stubOne(EventGroup);
            const eventStub = stubOne(Event);
            const ordererMock = stubOne(Profile) as Orderer;

            teamSettingServiceStub.fetchTeamWorkspaceStatus.resolves(false);
            productsServiceStub.findTeamPlanProduct.resolves(productStub);
            userServiceStub.search.resolves(searchedTeamMemberMocksStubs);
            userServiceStub.findUser.resolves(ownerUserMockStub);

            const _createStub = serviceSandbox.stub(service, '_create');
            _createStub.resolves(teamMockStub);

            paymentMethodServiceStub._create.resolves(paymentMethodMockStub);
            ordersServiceStub._create.resolves(orderMockStub);
            paymentsServiceStub._create.resolves(paymentStub);
            ordersServiceStub._updateOrderStatus.resolves(true);

            utilServiceStub.createNewProfile
                .onFirstCall()
                .returns(profileStubs[0])
                .callsFake(() => profileStubs[1]);

            profilesServiceStub._create.resolvesArg(1);

            utilServiceStub.getDefaultAvailability.returns(availabilityStub);
            availabilityServiceStub._create.resolvesArg(3);
            eventGroupRepositoryStub.save.resolves(eventGroupStub);
            utilServiceStub.getDefaultEvent.returns(eventStub);
            eventsServiceStub._create.resolves(eventStub);

            utilServiceStub.filterInvitedNewUsers.returns([]);
            profilesServiceStub.saveInvitedNewTeamMember.returns(of(true));
            notificationsStub.sendTeamInvitation.returns(of(true));

            const result = await firstValueFrom(service.create(
                orderMockStub.unit,
                paymentMethodMockStub,
                teamMockStub,
                teamSettingMock,
                searchedTeamMemberMocksStubs as InvitedNewTeamMember[],
                ordererMock,
                ownerUserMockStub.id
            ));
            expect(result).ok;

            expect(teamSettingServiceStub.fetchTeamWorkspaceStatus.called).true;
            expect(productsServiceStub.findTeamPlanProduct.called).true;
            expect(userServiceStub.search.called).true;

            expect(_createStub.called).true;

            expect(paymentMethodServiceStub._create.called).true;
            expect(ordersServiceStub._create.called).true;
            expect(paymentsServiceStub._create.called).true;
            expect(ordersServiceStub._updateOrderStatus.called).true;
            expect(utilServiceStub.createNewProfile.called).true;
            expect(profilesServiceStub._create.called).true;

            expect(utilServiceStub.getDefaultAvailability.called).true;
            expect(availabilityServiceStub._create.called).true;
            expect(eventGroupRepositoryStub.save.called).true;
            expect(utilServiceStub.getDefaultEvent.called).true;
            expect(eventsServiceStub._create.called).true;

            expect(utilServiceStub.filterInvitedNewUsers.called).true;
            expect(notificationsStub.sendTeamInvitation.called).true;

            const passedNewProfiles = profilesServiceStub._create.getCall(0).args[1] as Profile[];
            const ownerProfile = passedNewProfiles.find((_profile) => _profile.userId === ownerUserMockStub.id);
            expect(ownerProfile).ok;
            expect(ownerProfile?.roles).includes(Role.OWNER);
        });

        it('should be created a team and given a team setting with transaction', async () => {

            const teamMockStub = stubOne(Team);
            const teamSettingMock = stubOne(TeamSetting, {
                workspace: 'newWorkspace'
            });

            teamRepositoryStub.create.returns(teamMockStub);
            teamRepositoryStub.save.resolves(teamMockStub);
            teamSettingServiceStub._updateTeamWorkspace.resolves(true);

            await service._create(
                datasourceMock as unknown as EntityManager,
                teamMockStub,
                teamSettingMock
            );

            expect(teamRepositoryStub.create.called).true;
            expect(teamRepositoryStub.save.called).true;
            expect(teamSettingServiceStub._updateTeamWorkspace.called).true;
        });

        it('should be created a team and to initialize team setting with transaction', async () => {

            const teamMockStub = stubOne(Team);
            const workspaceMock = 'newWorkspace';

            teamRepositoryStub.create.returns(teamMockStub);
            teamRepositoryStub.save.resolves(teamMockStub);
            teamSettingServiceStub._updateTeamWorkspace.resolves(true);

            await service._create(
                datasourceMock as unknown as EntityManager,
                teamMockStub,
                {
                    workspace: workspaceMock
                }
            );

            expect(teamRepositoryStub.create.called).true;
            expect(teamRepositoryStub.save.called).true;
            expect(teamSettingServiceStub._updateTeamWorkspace.called).true;
        });

        it('should be thrown an already used workspace error', async () => {

            const ownerUserMockStub = stubOne(User);
            const searchedTeamMemberMocksStubs = stub(User);

            const teamMockStub = stubOne(Team);
            const paymentMethodMockStub = stubOne(PaymentMethod);
            const orderMockStub = stubOne(Order);
            const teamSettingMock = stubOne(TeamSetting);
            const ordererMock = stubOne(Profile) as Orderer;

            teamSettingServiceStub.fetchTeamWorkspaceStatus.resolves(true);

            await expect(firstValueFrom(service.create(
                orderMockStub.unit,
                paymentMethodMockStub,
                teamMockStub,
                teamSettingMock,
                searchedTeamMemberMocksStubs as InvitedNewTeamMember[],
                ordererMock,
                ownerUserMockStub.id
            ))).rejectedWith(AlreadyUsedInWorkspace);

            expect(teamSettingServiceStub.fetchTeamWorkspaceStatus.called).true;
            expect(productsServiceStub.findTeamPlanProduct.called).false;
            expect(userServiceStub.search.called).false;
            expect(paymentMethodServiceStub._create.called).false;
            expect(ordersServiceStub._create.called).false;
            expect(paymentsServiceStub._create.called).false;
            expect(ordersServiceStub._updateOrderStatus.called).false;
            expect(profilesServiceStub._create.called).false;
            expect(utilServiceStub.filterInvitedNewUsers.called).false;
            expect(notificationsStub.sendTeamInvitation.called).false;
        });
    });

    it('should be patched for team setting', async () => {
        const teamIdMock = 123;

        const teamMock = stubOne(Team);

        const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

        teamRepositoryStub.update.resolves(updateResultStub);

        const updateResult = await firstValueFrom(service.patch(teamIdMock, teamMock));
        expect(updateResult).ok;
        expect(teamRepositoryStub.update.called).true;
    });

    describe('Team Delete Test', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            profilesServiceStub.search.reset();
            profilesServiceStub.searchInvitations.reset();

            teamRepositoryStub.findOneByOrFail.reset();

            ordersServiceStub.fetch.reset();
            teamSettingServiceStub._delete.reset();

            utilServiceStub.getProration.reset();
            paymentsServiceStub._refund.reset();

            serviceSandbox.restore();
        });

        it('should be deleted a team', async () => {
            const authProfileMock = stubOne(Profile) as unknown as AppJwtPayload;
            const orderMock = stubOne(Order);

            const teamStub = stubOne(Team);
            const paymentStub = stubOne(Payment);

            const _deleteStub = serviceSandbox.stub(service, '_delete');

            profilesServiceStub.search.returns(of([]));
            profilesServiceStub.searchInvitations.returns(of([]));
            teamRepositoryStub.findOneByOrFail.resolves(teamStub);

            ordersServiceStub.fetch.returns(of(orderMock));

            teamSettingServiceStub._delete.returns(of(true));
            _deleteStub.returns(of(true));

            utilServiceStub.getProration.returns(0);
            paymentsServiceStub._refund.returns(of(true));
            paymentsServiceStub._save.resolves(paymentStub);

            const deleteSuccess = await firstValueFrom(service.delete(authProfileMock));

            expect(deleteSuccess).true;

            expect(profilesServiceStub.search.called).true;
            expect(profilesServiceStub.searchInvitations.called).true;
            expect(teamRepositoryStub.findOneByOrFail.called).true;
            expect(ordersServiceStub.fetch.called).true;

            expect(teamSettingServiceStub._delete.called).true;
            expect(_deleteStub.called).true;
            expect(utilServiceStub.getProration.called).true;
            expect(paymentsServiceStub._refund.called).true;
        });

        it('should be thrown an error for delete request when the team has the profiles', async () => {
            const authProfileMock = stubOne(Profile) as unknown as AppJwtPayload;
            const profileStubs = stub(Profile);
            const orderMock = stubOne(Order);

            const teamStub = stubOne(Team);
            const paymentStub = stubOne(Payment);

            const _deleteStub = serviceSandbox.stub(service, '_delete');

            profilesServiceStub.search.returns(of(profileStubs));
            profilesServiceStub.searchInvitations.returns(of([]));
            teamRepositoryStub.findOneByOrFail.resolves(teamStub);

            ordersServiceStub.fetch.returns(of(orderMock));

            teamSettingServiceStub._delete.returns(of(true));
            _deleteStub.returns(of(true));

            utilServiceStub.getProration.returns(0);
            paymentsServiceStub._refund.returns(of(true));
            paymentsServiceStub._save.resolves(paymentStub);

            await expect(firstValueFrom(service.delete(authProfileMock))).rejectedWith(CannotDeleteTeamException);

            expect(profilesServiceStub.search.called).true;
            expect(profilesServiceStub.searchInvitations.called).true;
            expect(teamRepositoryStub.findOneByOrFail.called).false;
            expect(ordersServiceStub.fetch.called).true;

            expect(teamSettingServiceStub._delete.called).false;
            expect(_deleteStub.called).false;
            expect(utilServiceStub.getProration.called).false;
            expect(paymentsServiceStub._refund.called).false;
        });

        it('should be thrown an error for delete request when the team has the invitations', async () => {
            const authProfileMock = stubOne(Profile) as unknown as AppJwtPayload;
            const teamMock = stubOne(Team);
            const invitedNewMemberStubs = testMockUtil.getInvitedNewTeamMemberMocks(teamMock.id);
            const orderMock = stubOne(Order);

            const teamStub = stubOne(Team);
            const paymentStub = stubOne(Payment);

            const _deleteStub = serviceSandbox.stub(service, '_delete');

            profilesServiceStub.search.returns(of([]));
            profilesServiceStub.searchInvitations.returns(of(invitedNewMemberStubs));
            teamRepositoryStub.findOneByOrFail.resolves(teamStub);

            ordersServiceStub.fetch.returns(of(orderMock));

            teamSettingServiceStub._delete.returns(of(true));
            _deleteStub.returns(of(true));

            utilServiceStub.getProration.returns(0);
            paymentsServiceStub._refund.returns(of(true));
            paymentsServiceStub._save.resolves(paymentStub);

            await expect(firstValueFrom(service.delete(authProfileMock))).rejectedWith(CannotDeleteTeamException);

            expect(profilesServiceStub.search.called).true;
            expect(profilesServiceStub.searchInvitations.called).true;
            expect(teamRepositoryStub.findOneByOrFail.called).false;
            expect(ordersServiceStub.fetch.called).true;

            expect(teamSettingServiceStub._delete.called).false;
            expect(_deleteStub.called).false;
            expect(utilServiceStub.getProration.called).false;
            expect(paymentsServiceStub._refund.called).false;
        });
    });

    describe('Test __getTeamOptionQuery', () => {
        let serviceSandbox: sinon.SinonSandbox;

        let teamQueryBuilderStub: SinonStubbedInstance<SelectQueryBuilder<Team>>;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            const teamsStub = stub(Team);

            teamQueryBuilderStub = stubQueryBuilder(
                serviceSandbox,
                Team,
                teamsStub
            );
        });

        afterEach(() => {

            teamQueryBuilderStub.leftJoin.reset();
            teamQueryBuilderStub.leftJoinAndSelect.reset();
            teamQueryBuilderStub.where.reset();
            teamQueryBuilderStub.loadRelationCountAndMap.reset();

            serviceSandbox.restore();
        });

        [
            {
                optionsMock: {
                    userId: 1
                } as Partial<TeamSearchOption>,
                expectation: (_teamQueryBuilderStub: SinonStubbedInstance<SelectQueryBuilder<Team>>) => {
                    expect(_teamQueryBuilderStub.leftJoin.called).true;
                    expect(_teamQueryBuilderStub.leftJoinAndSelect.called).true;
                    expect(_teamQueryBuilderStub.where.called).true;
                }
            },
            {
                optionsMock: {
                    withMemberCounts: true
                } as Partial<TeamSearchOption>,
                expectation: (_teamQueryBuilderStub: SinonStubbedInstance<SelectQueryBuilder<Team>>) => {
                    expect(_teamQueryBuilderStub.loadRelationCountAndMap.called).true;
                }
            }
        ].forEach(function ({
            optionsMock,
            expectation
        }) {
            it('should be patched for user id option', () => {

                const userIdMock = stubOne(User).id;

                const composedTeamQueryBuilder = service.__getTeamOptionQuery(
                    optionsMock,
                    userIdMock,
                    teamQueryBuilderStub
                );

                expectation(composedTeamQueryBuilder as SinonStubbedInstance<SelectQueryBuilder<Team>>);
            });

        });

    });
});
