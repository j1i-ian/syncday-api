import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { firstValueFrom, of } from 'rxjs';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { stubQueryBuilder } from 'typeorm-faker';
import { Role } from '@interfaces/profiles/role.enum';
import { SearchTeamsWithOptions } from '@interfaces/teams/search-teams-with-options.interface';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { UserService } from '@services/users/user.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { ProductsService } from '@services/products/products.service';
import { OrdersService } from '@services/orders/orders.service';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { PaymentsService } from '@services/payments/payments.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { UtilService } from '@services/util/util.service';
import { Team } from '@entity/teams/team.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { User } from '@entity/users/user.entity';
import { Product } from '@entity/products/product.entity';
import { Order } from '@entity/orders/order.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { Payment } from '@entity/payments/payment.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { TeamService } from './team.service';

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
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let notificationsStub: sinon.SinonStubbedInstance<NotificationsService>;

    let teamRepositoryStub: sinon.SinonStubbedInstance<Repository<Team>>;

    before(async () => {

        teamSettingServiceStub = sinon.createStubInstance(TeamSettingService);
        userServiceStub = sinon.createStubInstance(UserService);
        profilesServiceStub = sinon.createStubInstance(ProfilesService);
        productsServiceStub = sinon.createStubInstance(ProductsService);
        ordersServiceStub = sinon.createStubInstance(OrdersService);
        paymentMethodServiceStub = sinon.createStubInstance(PaymentMethodService);
        paymentsServiceStub = sinon.createStubInstance(PaymentsService);
        utilServiceStub = sinon.createStubInstance(UtilService);
        notificationsStub = sinon.createStubInstance(NotificationsService);

        teamRepositoryStub = sinon.createStubInstance<Repository<Team>>(Repository);

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
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: NotificationsService,
                    useValue: notificationsStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(Team),
                    useValue: teamRepositoryStub
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
            const optionMock = {} as SearchTeamsWithOptions;

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

    describe('Test team creating', () => {
        let serviceSandbox: sinon.SinonSandbox;

        before(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {

            teamRepositoryStub.create.reset();
            teamRepositoryStub.save.reset();
            teamSettingServiceStub._updateTeamWorkspace.reset();

            productsServiceStub.findTeamPlanProduct.reset();
            userServiceStub.searchByEmailOrPhone.reset();
            paymentMethodServiceStub._create.reset();
            ordersServiceStub._create.reset();
            paymentsServiceStub._create.reset();
            profilesServiceStub._create.reset();
            profilesServiceStub.saveInvitedNewTeamMember.reset();
            utilServiceStub.filterInvitedNewUsers.reset();
            notificationsStub.sendTeamInvitationForNewUsers.reset();

            teamRepositoryStub.create.reset();
            teamRepositoryStub.save.reset();

            serviceSandbox.restore();
        });

        it('should be created a team with order, payment method, invitations', async () => {

            const ownerUserMockStub = stubOne(User);
            const productStub = stubOne(Product);
            const searchedTeamMemberMocksStubs = stub(User);

            const teamMockStub = stubOne(Team);
            const paymentMethodMockStub = stubOne(PaymentMethod);
            const orderMockStub = stubOne(Order);
            const paymentStub = stubOne(Payment);

            const profileStubs = stub(Profile);
            const teamSettingMock = stubOne(TeamSetting);

            productsServiceStub.findTeamPlanProduct.resolves(productStub);
            userServiceStub.searchByEmailOrPhone.resolves(searchedTeamMemberMocksStubs);
            userServiceStub.findUserById.resolves(ownerUserMockStub);

            const _createStub = serviceSandbox.stub(service, '_create');
            _createStub.resolves(teamMockStub);

            paymentMethodServiceStub._create.resolves(paymentMethodMockStub);
            ordersServiceStub._create.resolves(orderMockStub);
            paymentsServiceStub._create.resolves(paymentStub);
            ordersServiceStub._updateOrderStatus.resolves(true);
            profilesServiceStub._create.resolves(profileStubs);
            utilServiceStub.filterInvitedNewUsers.returns([]);
            profilesServiceStub.saveInvitedNewTeamMember.returns(of(true));
            notificationsStub.sendTeamInvitationForNewUsers.returns(of(true));

            const result = await firstValueFrom(service.create(
                orderMockStub,
                paymentMethodMockStub,
                teamMockStub,
                teamSettingMock,
                searchedTeamMemberMocksStubs,
                ownerUserMockStub.id
            ));
            expect(result).ok;

            expect(productsServiceStub.findTeamPlanProduct.called).true;
            expect(userServiceStub.searchByEmailOrPhone.called).true;

            expect(_createStub.called).true;

            expect(paymentMethodServiceStub._create.called).true;
            expect(ordersServiceStub._create.called).true;
            expect(paymentsServiceStub._create.called).true;
            expect(ordersServiceStub._updateOrderStatus.called).true;
            expect(profilesServiceStub._create.called).true;
            expect(utilServiceStub.filterInvitedNewUsers.called).true;
            expect(notificationsStub.sendTeamInvitationForNewUsers.called).true;

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
                } as Partial<SearchTeamsWithOptions>,
                expectation: (_teamQueryBuilderStub: SinonStubbedInstance<SelectQueryBuilder<Team>>) => {
                    expect(_teamQueryBuilderStub.leftJoin.called).true;
                    expect(_teamQueryBuilderStub.leftJoinAndSelect.called).true;
                    expect(_teamQueryBuilderStub.where.called).true;
                }
            },
            {
                optionsMock: {
                    withMemberCounts: true
                } as Partial<SearchTeamsWithOptions>,
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
