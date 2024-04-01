import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, FindOptionsWhere, Repository, SelectQueryBuilder } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, of } from 'rxjs';
import { ForbiddenException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Role } from '@interfaces/profiles/role.enum';
import { ProfileSearchOption } from '@interfaces/profiles/profile-search-option.interface';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { ProfileStatus } from '@interfaces/profiles/profile-status.enum';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { UserService } from '@services/users/user.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { UtilService } from '@services/util/util.service';
import { ProductsService } from '@services/products/products.service';
import { OrdersService } from '@services/orders/orders.service';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { PaymentsService } from '@services/payments/payments.service';
import { TeamService } from '@services/team/team.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { TeamRedisRepository } from '@services/team/team.redis-repository';
import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';
import { User } from '@entity/users/user.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { Product } from '@entity/products/product.entity';
import { Order } from '@entity/orders/order.entity';
import { Payment } from '@entity/payments/payment.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledEventNotification } from '@entity/scheduled-events/scheduled-event-notification.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { ProfilesService } from './profiles.service';

const testMockUtil = new TestMockUtil();

describe('ProfilesService', () => {
    let service: ProfilesService;

    let module: TestingModule;

    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let productsServiceStub: sinon.SinonStubbedInstance<ProductsService>;
    let ordersServiceStub: sinon.SinonStubbedInstance<OrdersService>;
    let paymentMethodServiceStub: sinon.SinonStubbedInstance<PaymentMethodService>;
    let paymentsServiceStub: sinon.SinonStubbedInstance<PaymentsService>;
    let notificationServiceStub: sinon.SinonStubbedInstance<NotificationsService>;
    let teamServiceStub: sinon.SinonStubbedInstance<TeamService>;
    let availabilityServiceStub: sinon.SinonStubbedInstance<AvailabilityService>;

    let teamRedisRepositoryStub: sinon.SinonStubbedInstance<TeamRedisRepository>;
    let profilesRedisRepositoryStub: sinon.SinonStubbedInstance<ProfilesRedisRepository>;

    let profileRepositoryStub: sinon.SinonStubbedInstance<Repository<Profile>>;
    let availabilityRepositoryStub: sinon.SinonStubbedInstance<Repository<Availability>>;
    let scheduledEventNotificationRepositoryStub: sinon.SinonStubbedInstance<Repository<ScheduledEventNotification>>;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    before(async () => {

        utilServiceStub = sinon.createStubInstance(UtilService);
        userServiceStub = sinon.createStubInstance(UserService);
        productsServiceStub = sinon.createStubInstance(ProductsService);
        ordersServiceStub = sinon.createStubInstance(OrdersService);
        paymentMethodServiceStub = sinon.createStubInstance(PaymentMethodService);
        paymentsServiceStub = sinon.createStubInstance(PaymentsService);
        notificationServiceStub = sinon.createStubInstance(NotificationsService);
        teamServiceStub = sinon.createStubInstance(TeamService);
        availabilityServiceStub = sinon.createStubInstance(AvailabilityService);

        teamRedisRepositoryStub = sinon.createStubInstance(TeamRedisRepository);
        profilesRedisRepositoryStub = sinon.createStubInstance<ProfilesRedisRepository>(ProfilesRedisRepository);

        profileRepositoryStub = sinon.createStubInstance<Repository<Profile>>(Repository);
        availabilityRepositoryStub = sinon.createStubInstance<Repository<Availability>>(Repository);
        scheduledEventNotificationRepositoryStub = sinon.createStubInstance<Repository<ScheduledEventNotification>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                ProfilesService,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: NotificationsService,
                    useValue: notificationServiceStub
                },
                {
                    provide: UserService,
                    useValue: userServiceStub
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
                    provide: TeamService,
                    useValue: teamServiceStub
                },
                {
                    provide: AvailabilityService,
                    useValue: availabilityServiceStub
                },
                {
                    provide: TeamRedisRepository,
                    useValue: teamRedisRepositoryStub
                },
                {
                    provide: ProfilesRedisRepository,
                    useValue: profilesRedisRepositoryStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(Profile),
                    useValue: profileRepositoryStub
                },
                {
                    provide: getRepositoryToken(Availability),
                    useValue: availabilityRepositoryStub
                },
                {
                    provide: getRepositoryToken(ScheduledEventNotification),
                    useValue: scheduledEventNotificationRepositoryStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: TestMockUtil.getLoggerStub()
                }
            ]
        }).compile();

        service = module.get<ProfilesService>(ProfilesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Profile Filter Test', () => {
        let serviceSandbox: sinon.SinonSandbox;

        let profileQueryBuilderStub: sinon.SinonStubbedInstance<SelectQueryBuilder<Profile>>;

        beforeEach(() => {

            serviceSandbox = sinon.createSandbox();

            profileQueryBuilderStub = stubQueryBuilder(serviceSandbox, Profile);

            // Complement typeorm-faker
            profileQueryBuilderStub.groupBy.returns(profileQueryBuilderStub);
            profileQueryBuilderStub.addGroupBy.returns(profileQueryBuilderStub);

            profileRepositoryStub.createQueryBuilder.returns(profileQueryBuilderStub);
        });

        afterEach(() => {
            profilesRedisRepositoryStub.filterAlreadyInvited.reset();
            utilServiceStub.convertToInvitedNewTeamMember.reset();

            serviceSandbox.restore();
        });

        [
            {
                description: 'should be filtered already invited email or phone by new user invitation sending is detected (NoSQL check)',
                getInvitedNewTeamMemberMocks: (teamIdMock: number) => testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock),
                getNewInvitationTeamMemberMocks: (teamIdMock: number) => testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock),
                getAlreadyJoinedTeamProfilesMock: () => [],
                expectedAlreadySentInvitations: true,
                convertToInvitedNewTeamMemberCall: true
            },
            {
                description: 'should be filtered already invited email or phone by oldby user profile is detected (RDB check)',
                getInvitedNewTeamMemberMocks: () => [],
                getNewInvitationTeamMemberMocks: (teamIdMock: number) => {
                    const invitedNewTeamMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock);
                    invitedNewTeamMemberMocks[0].email = 'emailStub';
                    invitedNewTeamMemberMocks[1].phone = 'phoneStub';

                    return invitedNewTeamMemberMocks;
                },
                getAlreadyJoinedTeamProfilesMock: () => {

                    const userStubs = [
                        stubOne(User, {
                            email: 'emailStub'
                        }),
                        stubOne(User, {
                            phone: 'phoneStub'
                        })
                    ];
                    const alreadyJoinedTeamProfilesMock = [
                        stubOne(Profile, { user: userStubs[0] }),
                        stubOne(Profile, { user: userStubs[1] })
                    ];

                    return alreadyJoinedTeamProfilesMock;
                },
                expectedAlreadySentInvitations: true,
                convertToInvitedNewTeamMemberCall: false
            },
            {
                description: 'should be filtered only for email bulk',
                getInvitedNewTeamMemberMocks: () => [],
                getNewInvitationTeamMemberMocks: (teamIdMock: number) => {
                    const invitedNewTeamMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock);

                    const invitedNewTeamMember = invitedNewTeamMemberMocks[0];
                    invitedNewTeamMember.email = 'emailStub';
                    invitedNewTeamMember.phone = undefined;

                    return [invitedNewTeamMember];
                },
                getAlreadyJoinedTeamProfilesMock: () => [],
                expectedAlreadySentInvitations: false,
                convertToInvitedNewTeamMemberCall: false
            },
            {
                description: 'should be filtered only for phone bulk',
                getInvitedNewTeamMemberMocks: () => [],
                getNewInvitationTeamMemberMocks: (teamIdMock: number) => {
                    const invitedNewTeamMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock);

                    const invitedNewTeamMember = invitedNewTeamMemberMocks[0];
                    invitedNewTeamMember.email = undefined;
                    invitedNewTeamMember.phone = 'phoneStub';

                    return [invitedNewTeamMember];
                },
                getAlreadyJoinedTeamProfilesMock: () => [],
                expectedAlreadySentInvitations: false,
                convertToInvitedNewTeamMemberCall: false
            }
        ].forEach(function({
            description,
            getInvitedNewTeamMemberMocks,
            getNewInvitationTeamMemberMocks,
            getAlreadyJoinedTeamProfilesMock,
            expectedAlreadySentInvitations,
            convertToInvitedNewTeamMemberCall
        }) {

            it(description, async () => {

                const teamMock = stubOne(Team);
                const teamIdMock = teamMock.id;

                const newInvitationTeamMemberMocks = getNewInvitationTeamMemberMocks(teamIdMock);
                const invitedNewTeamMemberMocks = getInvitedNewTeamMemberMocks(teamIdMock);

                const alreadyInvitedEmailOrPhoneArray = invitedNewTeamMemberMocks.map((_invitedNewTeamMemberMock) => (_invitedNewTeamMemberMock.email || _invitedNewTeamMemberMock.phone) as string);

                const alreadyJoinedTeamProfilesMock = getAlreadyJoinedTeamProfilesMock();

                profilesRedisRepositoryStub.filterAlreadyInvited.resolves(alreadyInvitedEmailOrPhoneArray);
                utilServiceStub.convertToInvitedNewTeamMember.returns(invitedNewTeamMemberMocks[0]);

                profileQueryBuilderStub.getMany.resolves(alreadyJoinedTeamProfilesMock);

                const alreadySentInvitations = await firstValueFrom(
                    service.filterProfiles(
                        teamIdMock,
                        teamMock.uuid,
                        newInvitationTeamMemberMocks
                    )
                );

                expect(alreadySentInvitations).ok;

                if (expectedAlreadySentInvitations) {
                    expect(alreadySentInvitations.length).greaterThan(0);
                } else {
                    expect(alreadySentInvitations.length).equals(0);
                }

                expect(profilesRedisRepositoryStub.filterAlreadyInvited.called).true;
                expect(utilServiceStub.convertToInvitedNewTeamMember.called).equals(convertToInvitedNewTeamMemberCall);

                expect(profileQueryBuilderStub.getMany.called).true;
            });
        });

        // Test Empty Array or one bulk type profiles
        it('should be returned empty array for empty array body', async () => {

            const teamMock = stubOne(Team);
            profilesRedisRepositoryStub.filterAlreadyInvited.resolves([]);

            const invitedNewTeamMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(teamMock.id);
            utilServiceStub.convertToInvitedNewTeamMember.returns(invitedNewTeamMemberMocks[0]);

            profileQueryBuilderStub.getMany.resolves([]);

            const alreadySentInvitations = await firstValueFrom(
                service.filterProfiles(
                    teamMock.id,
                    teamMock.uuid,
                    []
                )
            );

            expect(alreadySentInvitations.length).equals(0);

            expect(profilesRedisRepositoryStub.filterAlreadyInvited.called).false;
            expect(utilServiceStub.convertToInvitedNewTeamMember.called).false;
            expect(profileQueryBuilderStub.getMany.called).false;
        });
    });

    describe('Count invitation Test', () => {

        it('coverage fill: countTeamInvitations', async () => {

            const teamUUIDMock = stubOne(Team).uuid;
            const invitationCountStub = 1;

            profilesRedisRepositoryStub.countTeamInvitations.resolves(invitationCountStub);

            const actualInvitationCount = await service.countTeamInvitations(teamUUIDMock);

            expect(actualInvitationCount).equals(invitationCountStub);
        });

    });

    describe('Profile Search Test', () => {
        let serviceSandbox: sinon.SinonSandbox;

        let profileSearchQueryBuilderStub: SinonStubbedInstance<SelectQueryBuilder<Profile>>;

        beforeEach(() => {

            serviceSandbox = sinon.createSandbox();

            const profileStubs = stub(Profile);

            profileSearchQueryBuilderStub = stubQueryBuilder(
                serviceSandbox,
                Profile,
                profileStubs
            );
            profileRepositoryStub.createQueryBuilder.returns(profileSearchQueryBuilderStub);
        });

        afterEach(() => {
            profileSearchQueryBuilderStub.where.reset();
            profileSearchQueryBuilderStub.andWhere.reset();
            profileSearchQueryBuilderStub.getMany.reset();
        });

        [
            {
                description: 'should be searched profiles without any search options',
                searchOptionMock: {} as Partial<ProfileSearchOption>,
                whereCall: false,
                andWhereCall: false,
                addSelectCallCount: 1,
                leftJoinCall: false,
                orderByCall: true,
                getManyCall: true
            },
            {
                description: 'should be searched profiles by user id',
                searchOptionMock: { userId: 1 } as Partial<ProfileSearchOption>,
                whereCall: true,
                andWhereCall: false,
                addSelectCallCount: 1,
                leftJoinCall: false,
                orderByCall: true,
                getManyCall: true
            },
            {
                description: 'should be searched profiles by team id',
                searchOptionMock: { teamId: 1 } as Partial<ProfileSearchOption>,
                whereCall: false,
                andWhereCall: true,
                addSelectCallCount: 1,
                leftJoinCall: false,
                orderByCall: true,
                getManyCall: true
            },
            {
                description: 'should be searched profiles with withUserData option',
                searchOptionMock: { withUserData: true } as Partial<ProfileSearchOption>,
                whereCall: false,
                andWhereCall: false,
                addSelectCallCount: 2,
                leftJoinCall: true,
                orderByCall: true,
                getManyCall: true
            }
        ].forEach(function ({
            description,
            searchOptionMock,
            whereCall,
            andWhereCall,
            addSelectCallCount,
            leftJoinCall,
            orderByCall,
            getManyCall
        }) {

            it(description, async () => {
                const loadedProfiles =  await firstValueFrom(service.search(searchOptionMock));

                expect(loadedProfiles).ok;
                expect(loadedProfiles.length).greaterThan(0);
                expect(profileSearchQueryBuilderStub.where.called).equals(whereCall);
                expect(profileSearchQueryBuilderStub.andWhere.called).equals(andWhereCall);
                expect(profileSearchQueryBuilderStub.addSelect.callCount).equals(addSelectCallCount);
                expect(profileSearchQueryBuilderStub.leftJoin.called).equals(leftJoinCall);
                expect(profileSearchQueryBuilderStub.orderBy.called).equals(orderByCall);
                expect(profileSearchQueryBuilderStub.getMany.called).equals(getManyCall);
            });

        });
    });

    describe('Invitation Search Test', () => {
        it('should be searched invitations', async () => {

            const teamMock = stubOne(Team);
            const teamUUIDMock = teamMock.uuid;

            const invitedNewTeamMemberMockStubs = testMockUtil.getInvitedNewTeamMemberMocks(0);

            const emailOrPhoneBulkStubs = invitedNewTeamMemberMockStubs.map((_invitedNewTeamMemberMock) => (_invitedNewTeamMemberMock.email || _invitedNewTeamMemberMock.phone) as string);

            profilesRedisRepositoryStub.getAllTeamInvitations.resolves(emailOrPhoneBulkStubs);
            utilServiceStub.convertToInvitedNewTeamMember.returns(invitedNewTeamMemberMockStubs[0]);

            const invitedNewTeamMembers = await firstValueFrom(service.searchInvitations(teamUUIDMock));

            expect(invitedNewTeamMembers).ok;
            expect(invitedNewTeamMembers.length).equals(invitedNewTeamMemberMockStubs.length);

            expect(profilesRedisRepositoryStub.getAllTeamInvitations.called).true;
            expect(utilServiceStub.convertToInvitedNewTeamMember.called).true;
        });
    });

    describe('Profile Fetch Test', () => {

        afterEach(() => {
            profileRepositoryStub.findOneOrFail.reset();
        });

        it('should be found profile by profile id', async () => {
            const profileStub = stubOne(Profile);

            profileRepositoryStub.findOneOrFail.resolves(profileStub);

            const loadedUser =  await firstValueFrom(service.fetch({
                id: profileStub.id
            }));

            const actualPassedParam = profileRepositoryStub.findOneOrFail.getCall(0).args[0];
            expect((actualPassedParam.where as FindOptionsWhere<Profile>).id).equals(profileStub.id);

            expect(loadedUser).equal(profileStub);
        });

        it('should be fetched the team owner profile with team name, user email, phone', async () => {

            const teamIdMock = stubOne(Team).id;
            const profileStub = stubOne(Profile);

            profileRepositoryStub.findOneOrFail.resolves(profileStub);

            const ownerProfile = await firstValueFrom(service._fetchTeamOwnerProfile(teamIdMock));

            expect(ownerProfile).ok;
            expect(profileRepositoryStub.findOneOrFail.called).true;
        });
    });

    describe('Test bulk creating of profiles for invitation purposes', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            paymentMethodServiceStub.fetch.reset();

            productsServiceStub.findTeamPlanProduct.reset();
            userServiceStub.search.reset();
            ordersServiceStub._create.reset();
            paymentMethodServiceStub._create.reset();
            paymentsServiceStub._create.reset();
            ordersServiceStub._updateOrderStatus.reset();
            utilServiceStub.createNewProfile.reset();

            utilServiceStub.filterInvitedNewUsers.reset();

            notificationServiceStub.sendTeamInvitation.reset();

            teamRedisRepositoryStub.incrementMemberCount.reset();

            serviceSandbox.restore();
        });

        [
            {
                description: 'should be bulk creating of profiles for sync user',
                newPaymentMethodMock: undefined,
                getSearchedUserStubs: () => {
                    const syncUserStub = stubOne(User);
                    return [ syncUserStub ];
                },
                getFilterInvitedNewUsersStubs: () => [],
                saveInvitedNewTeamMemberCall: false,
                createNewProfileCall: true
            },
            {
                description: 'should be bulk creating of invitations without profiles for new user',
                newPaymentMethodMock: undefined,
                getSearchedUserStubs: () => [],
                getFilterInvitedNewUsersStubs: (teamIdMock: number) => {
                    const nonAppUserInvitations = testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock);

                    return nonAppUserInvitations;
                },
                saveInvitedNewTeamMemberCall: true,
                createNewProfileCall: false
            },
            {
                description: 'should be bulk creating of invitations with creating payment method for initial deault team',
                newPaymentMethodMock: stubOne(PaymentMethod),
                getSearchedUserStubs: () => [],
                getFilterInvitedNewUsersStubs: (teamIdMock: number) => {
                    const nonAppUserInvitations = testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock);

                    return nonAppUserInvitations;
                },
                saveInvitedNewTeamMemberCall: true,
                createNewProfileCall: false
            }
        ].forEach(function({
            description,
            newPaymentMethodMock,
            getSearchedUserStubs,
            getFilterInvitedNewUsersStubs,
            saveInvitedNewTeamMemberCall,
            createNewProfileCall
        }) {

            it(description, async () => {

                const createNewPaymentMethod = !!newPaymentMethodMock;

                const teamMock = stubOne(Team);
                const teamIdMock = teamMock.id;
                const profileStub = stubOne(Profile);
                const userStubs = getSearchedUserStubs();
                const invitedNewUsersStubs = getFilterInvitedNewUsersStubs(teamIdMock);
                const ordererMock = stubOne(Profile);

                const paymentMethodStub = stubOne(PaymentMethod);
                const proudctStub = stubOne(Product);

                const teamOwnerProfileStub = stubOne(Profile, {
                    team: stubOne(Team),
                    user: stubOne(User)
                });

                const orderStub = stubOne(Order);
                const paymentStub = stubOne(Payment);
                const newInvitedNewTeamMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock);

                paymentMethodServiceStub.fetch.resolves(paymentMethodStub);
                const fetchTeamOwnerProfileStub = serviceSandbox.stub(service, '_fetchTeamOwnerProfile');
                fetchTeamOwnerProfileStub.returns(of(teamOwnerProfileStub));

                productsServiceStub.findTeamPlanProduct.resolves(proudctStub);
                userServiceStub.search.resolves(userStubs);
                ordersServiceStub._create.resolves(orderStub);
                paymentMethodServiceStub._create.resolves(paymentMethodStub);
                paymentsServiceStub._create.resolves(paymentStub);

                ordersServiceStub._updateOrderStatus.resolves(true);
                utilServiceStub.createNewProfile.returns(profileStub);

                const _createStub = serviceSandbox.stub(
                    service,
                    '_create'
                );
                _createStub.returnsArg(1);

                utilServiceStub.filterInvitedNewUsers.returns(invitedNewUsersStubs);
                const saveInvitedNewTeamMemberStub = serviceSandbox.stub(service, 'saveInvitedNewTeamMember');
                saveInvitedNewTeamMemberStub.returns(of(true));
                notificationServiceStub.sendTeamInvitation.returns(of(true));

                teamRedisRepositoryStub.incrementMemberCount.resolves();

                const createdProfile = await firstValueFrom(
                    service.createBulk(
                        teamIdMock,
                        teamMock.uuid,
                        newInvitedNewTeamMemberMocks,
                        ordererMock as Orderer,
                        newPaymentMethodMock
                    )
                );

                expect(createdProfile).true;

                expect(paymentMethodServiceStub.fetch.called).not.equals(createNewPaymentMethod);
                expect(fetchTeamOwnerProfileStub.called).true;

                expect(productsServiceStub.findTeamPlanProduct.called).true;
                expect(userServiceStub.search.called).true;
                expect(ordersServiceStub._create.called).true;
                expect(paymentMethodServiceStub._create.called).equals(createNewPaymentMethod);
                expect(paymentsServiceStub._create.called).true;

                expect(ordersServiceStub._updateOrderStatus.called).true;
                expect(utilServiceStub.createNewProfile.called).equals(createNewProfileCall);

                expect(_createStub.called).true;

                expect(utilServiceStub.filterInvitedNewUsers.called).true;
                expect(saveInvitedNewTeamMemberStub.called).equals(saveInvitedNewTeamMemberCall);

                expect(teamRedisRepositoryStub.incrementMemberCount.called).true;
                expect(notificationServiceStub.sendTeamInvitation.called).true;
            });
        });

    });

    describe('Test creating profile with transaction', () => {

        let serviceSandbox: SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            profileRepositoryStub.create.reset();
            profileRepositoryStub.save.reset();

            profilesRedisRepositoryStub.getTeamInvitations.reset();

            ordersServiceStub.fetch.reset();
            ordersServiceStub._update.reset();

            serviceSandbox.restore();
        });

        it('should be created a profile with transaction', async () => {

            const profileMockStub = stubOne(Profile);

            profileRepositoryStub.create.returns(profileMockStub);
            profileRepositoryStub.save.resolves(profileMockStub);

            const createdProfile = await service._create(
                datasourceMock as unknown as EntityManager,
                profileMockStub
            );

            expect(createdProfile).ok;

            expect(profileRepositoryStub.create.called).ok;
            expect(profileRepositoryStub.save.called).ok;
        });

        it('should be created multiple profiles with transaction', async () => {

            const profileMocksStubs = stub(Profile);

            profileRepositoryStub.create.returns(profileMocksStubs as any);
            profileRepositoryStub.save.resolves(profileMocksStubs as any);

            const createdProfiles = await service._create(
                datasourceMock as unknown as EntityManager,
                profileMocksStubs
            ) as Profile[];

            expect(createdProfiles).ok;
            expect(createdProfiles.length).greaterThan(0);

            expect(profileRepositoryStub.create.called).ok;
            expect(profileRepositoryStub.save.called).ok;
        });

        it('should be created invited profiles: interface', async () => {
            const userMock = stubOne(User);

            const invitedProfileStubs = stub(Profile);
            const defaultAvailabilityMock = stubOne(Availability);

            serviceSandbox.stub(service, '_createInvitedProfiles')
                .returns(of(invitedProfileStubs));

            const createdProfiles = await firstValueFrom(service.createInvitedProfiles(
                userMock,
                defaultAvailabilityMock
            ));

            expect(createdProfiles).ok;
            expect(createdProfiles.length).greaterThan(0);
        });

        it('should be created invited profiles with transaction', async () => {
            const userMock = stubOne(User);
            const orderStub = stubOne(Order);
            const teamStubs = stub(Team).map((_team) => ({ ..._team, orderId: orderStub.id }));
            const defaultAvailabilityMockStub = stubOne(Availability);

            profilesRedisRepositoryStub.getTeamInvitations.resolves(teamStubs);

            profileRepositoryStub.create.returnsArg(0);
            profileRepositoryStub.save.resolvesArg(0);

            availabilityServiceStub._create.resolvesArg(3);

            ordersServiceStub.fetch.returns(of(orderStub));
            ordersServiceStub._update.returns(of(true));

            const createdProfiles = await firstValueFrom(service._createInvitedProfiles(
                datasourceMock as unknown as EntityManager,
                userMock,
                defaultAvailabilityMockStub
            ));

            expect(createdProfiles).ok;
            expect(createdProfiles.length).greaterThan(0);

            expect(profileRepositoryStub.create.called).true;
            expect(profileRepositoryStub.save.called).true;
            expect(profilesRedisRepositoryStub.getTeamInvitations.called).true;

            expect(ordersServiceStub.fetch.called).true;
            expect(ordersServiceStub._update.called).true;
        });
    });

    it('coverage fill: saveInvitedNewTeamMember', async () => {
        const teamMock = stubOne(Team);
        const teamIdMock = stubOne(Team).id;
        const orderIdMock = stubOne(Order).id;
        const invitedNewTeamMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock);

        profilesRedisRepositoryStub.setTeamInvitations.resolves(true);

        const saveSuccess = await firstValueFrom(service.saveInvitedNewTeamMember(teamIdMock, teamMock.uuid, invitedNewTeamMemberMocks, orderIdMock));

        expect(saveSuccess).true;
        expect(profilesRedisRepositoryStub.setTeamInvitations.called).true;

        profilesRedisRepositoryStub.setTeamInvitations.reset();
    });

    describe('Test Profile Patching', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            profileRepositoryStub.update.reset();

            serviceSandbox.restore();
        });

        it('coverage fill: patch', async () => {

            const profileMock = stubOne(Profile);

            serviceSandbox.stub(service, '_patch').returns(of(true));

            const updateResult = await firstValueFrom(service.patch(profileMock.id, profileMock));
            expect(updateResult).ok;
        });

        it('should be patched for profile', async () => {
            const profileIdMock = 123;

            const profileMock = stubOne(Profile);

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            profileRepositoryStub.update.resolves(updateResultStub);

            const updateResult = await firstValueFrom(
                service._patch(
                    datasourceMock as unknown as EntityManager,
                    profileIdMock,
                    profileMock
                )
            );
            expect(updateResult).ok;
            expect(profileRepositoryStub.update.called).true;
        });
    });

    describe('Test Profile Roles Update', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            utilServiceStub.convertUpdateResultToBoolean.reset();

            profileRepositoryStub.update.reset();

            serviceSandbox.restore();
        });

        it('coverage fill: updateRoles', async () => {

            const teamIdMock = stubOne(Team).id;
            const authProfileIdMock = stubOne(Profile).id;
            const targetProfileIdMock = stubOne(Profile).id;

            serviceSandbox.stub(service, '_updateRoles').returns(of(true));

            const updateResult = await firstValueFrom(
                service.updateRoles(
                    teamIdMock,
                    authProfileIdMock,
                    targetProfileIdMock,
                    [Role.MANAGER]
                )
            );

            expect(updateResult).true;
        });

        it('should be updated the role to manager by manager for member', async () => {

            const profileMock = stubOne(Profile, {
                roles: [Role.MANAGER]
            });
            const targetProfileStub = stubOne(Profile, {
                roles: [Role.MEMBER]
            });
            const desireRoles = [Role.MEMBER];

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            utilServiceStub.convertUpdateResultToBoolean.returns(true);
            profileRepositoryStub.update.resolves(updateResultStub);

            const result = await firstValueFrom(service._updateRoles(
                datasourceMock as unknown as EntityManager,
                profileMock.teamId,
                profileMock.id,
                targetProfileStub.id,
                desireRoles
            ));

            expect(result).ok;
            expect(utilServiceStub.convertUpdateResultToBoolean.called).true;
            expect(profileRepositoryStub.update.called).true;
        });

        it('should be migrated the owner role to new owner by previous owner for member', async () => {

            const profileMock = stubOne(Profile, {
                roles: [Role.OWNER]
            });
            const targetProfileStub = stubOne(Profile, {
                roles: [Role.MEMBER]
            });
            const desireRoles = [Role.OWNER];

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            utilServiceStub.convertUpdateResultToBoolean.returns(true);
            profileRepositoryStub.update.resolves(updateResultStub);

            const result = await firstValueFrom(service._updateRoles(
                datasourceMock as unknown as EntityManager,
                profileMock.teamId,
                profileMock.id,
                targetProfileStub.id,
                desireRoles
            ));

            expect(result).ok;
            expect(utilServiceStub.convertUpdateResultToBoolean.calledTwice).true;
            expect(profileRepositoryStub.update.calledTwice).true;
        });
    });

    it('should be completed a invitation for new user', async () => {
        profilesRedisRepositoryStub.deleteTeamInvitations.resolves(true);

        const teamMock = stubOne(Team);
        const userMock = stubOne(User);

        await firstValueFrom(service.completeInvitation(teamMock.id, teamMock.uuid, userMock));

        expect(profilesRedisRepositoryStub.deleteTeamInvitations.calledTwice).true;

        profilesRedisRepositoryStub.deleteTeamInvitations.reset();
    });

    describe('Test Profile Delete', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            profileRepositoryStub.findOneByOrFail.reset();
            profileRepositoryStub.delete.reset();

            teamRedisRepositoryStub.decrementMemberCount.reset();

            serviceSandbox.restore();
        });

        it('should be removed a profile', async () => {

            const teamStub = stubOne(Team);
            const paymentStub = stubOne(Payment);
            const relatedOrderStub = stubOne(Order);
            const authProfile = stubOne(Profile, {
                roles: [Role.OWNER]
            });
            const profileIdMock = stubOne(Profile).id;
            const deleteTargetProfileStub = stubOne(Profile, {
                roles: [Role.MEMBER]
            });
            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();
            const deleteResultStub = TestMockUtil.getTypeormDeleteResultMock();

            profileRepositoryStub.findOneByOrFail.resolves(deleteTargetProfileStub);

            serviceSandbox.stub(service, 'validateDeleteProfilePermission');

            paymentsServiceStub._refund.returns(of(true));

            serviceSandbox.stub(service, '_fetchTeamOwnerProfile').returns(of(authProfile));
            teamServiceStub.get.returns(of(teamStub));
            ordersServiceStub.fetch.returns(of(relatedOrderStub));

            utilServiceStub.getProration.returns(0);

            availabilityRepositoryStub.softDelete.resolves(updateResultStub);
            availabilityRepositoryStub.update.resolves(updateResultStub);
            scheduledEventNotificationRepositoryStub.delete.resolves(deleteResultStub);
            profileRepositoryStub.delete.resolves(deleteResultStub);
            paymentsServiceStub._save.returns(of(paymentStub));
            teamRedisRepositoryStub.decrementMemberCount.resolves();

            await service.remove(
                teamStub.id,
                authProfile,
                profileIdMock
            );

            expect(profileRepositoryStub.findOneByOrFail.called).true;

            expect(teamServiceStub.get.called).true;
            expect(ordersServiceStub.fetch.called).true;
            expect(utilServiceStub.getProration.called).true;
            expect(paymentsServiceStub._refund.called).true;
            expect(availabilityRepositoryStub.softDelete.called).true;
            expect(availabilityRepositoryStub.update.called).true;
            expect(scheduledEventNotificationRepositoryStub.delete.called).true;
            expect(profileRepositoryStub.delete.called).true;
            expect(paymentsServiceStub._save.called).true;
            expect(teamRedisRepositoryStub.decrementMemberCount.called).true;
        });
    });

    describe('Test validate a role update rqeuest', () => {

        afterEach(() => {
            utilServiceStub.isValidRoleUpdateRequest.reset();
            profileRepositoryStub.findOneByOrFail.reset();
        });

        it('should be passed the validation when request is valid', () => {

            const authRolesMock = [Role.OWNER];
            const targetRolesMock = [Role.OWNER];
            const profileStub = stubOne(Profile, {
                status: ProfileStatus.ACTIVATED
            });

            const roleUpdateRequestValidStub = true;
            utilServiceStub.isValidRoleUpdateRequest.returns(roleUpdateRequestValidStub);
            profileRepositoryStub.findOneByOrFail.resolves(profileStub);

            expect(service.validateRoleUpdateRequest(
                authRolesMock,
                targetRolesMock,
                profileStub.id
            )).not.rejected;

            expect(utilServiceStub.isValidRoleUpdateRequest.called).true;
            expect(profileRepositoryStub.findOneByOrFail.called).true;
        });

        it('should be thrown an error when owner tries to migrate owner permission to pending status profile', () => {

            const authRolesMock = [Role.OWNER];
            const targetRolesMock = [Role.OWNER];
            const profileStub = stubOne(Profile, {
                status: ProfileStatus.PENDING
            });

            const roleUpdateRequestValidStub = true;
            utilServiceStub.isValidRoleUpdateRequest.returns(roleUpdateRequestValidStub);
            profileRepositoryStub.findOneByOrFail.resolves(profileStub);

            expect(service.validateRoleUpdateRequest(
                authRolesMock,
                targetRolesMock,
                profileStub.id
            )).rejectedWith(ForbiddenException);

            expect(utilServiceStub.isValidRoleUpdateRequest.called).true;
            expect(profileRepositoryStub.findOneByOrFail.called).true;
        });

        it('should be thrown an forbidden exception for permission over request', () => {

            const authRolesMock = [Role.MANAGER];
            const targetRolesMock = [Role.OWNER];
            const profileStub = stubOne(Profile);

            const roleUpdateRequestInvalidStub = false;
            utilServiceStub.isValidRoleUpdateRequest.returns(roleUpdateRequestInvalidStub);
            profileRepositoryStub.findOneByOrFail.resolves(profileStub);

            expect(service.validateRoleUpdateRequest(
                authRolesMock,
                targetRolesMock,
                profileStub.id
            )).rejectedWith(ForbiddenException);

            expect(utilServiceStub.isValidRoleUpdateRequest.called).true;
            expect(profileRepositoryStub.findOneByOrFail.called).false;
        });
    });

    it('should be completed a invitation for new user', async () => {
        profilesRedisRepositoryStub.deleteTeamInvitations.resolves(true);

        const teamMock = stubOne(Team);
        const userMock = stubOne(User);

        await firstValueFrom(service.completeInvitation(teamMock.id, teamMock.uuid, userMock));

        expect(profilesRedisRepositoryStub.deleteTeamInvitations.calledTwice).true;

        profilesRedisRepositoryStub.deleteTeamInvitations.reset();
    });

    describe('Test validateProfileDeleteRequest', () => {
        [
            {
                description: 'should be passed the validation when owner requests to delete a manager or member',
                authProfileId: 1,
                deleteTargetProfileId: 2,
                roles: [Role.OWNER],
                expectedThrow: false
            },
            {
                description: 'should be thrown an error when owner requests to delete himself',
                authProfileId: 1,
                deleteTargetProfileId: 1,
                roles: [Role.OWNER],
                expectedThrow: true
            },
            {
                description: 'should be passed the validation when manager requests to delete himself',
                authProfileId: 1,
                deleteTargetProfileId: 1,
                roles: [Role.MANAGER],
                expectedThrow: false
            },
            {
                description: 'should be passed the validation when member requests to delete himself',
                authProfileId: 1,
                deleteTargetProfileId: 1,
                roles: [Role.MEMBER],
                expectedThrow: false
            },
            {
                description: 'shoshould be thrown an error when member requests to delete others',
                authProfileId: 1,
                deleteTargetProfileId: 2,
                roles: [Role.MEMBER],
                expectedThrow: true
            }
        ].forEach(function({
            description,
            authProfileId,
            deleteTargetProfileId,
            roles,
            expectedThrow
        }) {
            it(description, () => {

                if (expectedThrow) {
                    expect(() => service.validateProfileDeleteRequest(
                        authProfileId,
                        deleteTargetProfileId,
                        roles
                    )).throws(ForbiddenException);
                } else {
                    expect(() => service.validateProfileDeleteRequest(
                        authProfileId,
                        deleteTargetProfileId,
                        roles
                    )).not.throws();
                }
            });

        });
    });

    describe('Delete Request Permission Test',() => {

        [
            {
                description: 'should be passed the validation when the owner requests to delete a manager',
                authProfileMock: stubOne(Profile, {
                    roles: [Role.OWNER]
                }),
                deleteProfileMock: stubOne(Profile, {
                    roles: [Role.MANAGER]
                }),
                expectedThrow: false
            },
            {
                description: 'should be passed the validation when the owner requests to delete a member',
                authProfileMock: stubOne(Profile, {
                    roles: [Role.OWNER]
                }),
                deleteProfileMock: stubOne(Profile, {
                    roles: [Role.MEMBER]
                }),
                expectedThrow: false
            },
            {
                description: 'should be thrown an error when any requests to delete a owner',
                authProfileMock: stubOne(Profile),
                deleteProfileMock: stubOne(Profile, {
                    roles: [Role.OWNER]
                }),
                expectedThrow: true
            },
            {
                description: 'should be passed the validation when the manager requests to delete himself',
                authProfileMock: stubOne(Profile, {
                    id: 1,
                    roles: [Role.MANAGER]
                }),
                deleteProfileMock: stubOne(Profile, {
                    id: 1,
                    roles: [Role.MANAGER]
                }),
                expectedThrow: false
            },
            {
                description: 'should be thrown an error when the manager requests to delete another manager',
                authProfileMock: stubOne(Profile, {
                    id: 1,
                    roles: [Role.MANAGER]
                }),
                deleteProfileMock: stubOne(Profile, {
                    id: 2,
                    roles: [Role.MANAGER]
                }),
                expectedThrow: true
            },
            {
                description: 'should be passed the validation when the manager requests to delete himself',
                authProfileMock: stubOne(Profile, {
                    id: 1,
                    roles: [Role.MEMBER]
                }),
                deleteProfileMock: stubOne(Profile, {
                    id: 1,
                    roles: [Role.MEMBER]
                }),
                expectedThrow: false
            },
            {
                description: 'should be thrown an error when member requests to delete the manager',
                authProfileMock: stubOne(Profile, {
                    id: 1,
                    roles: [Role.MEMBER]
                }),
                deleteProfileMock: stubOne(Profile, {
                    id: 2,
                    roles: [Role.MANAGER]
                }),
                expectedThrow: true
            },
            {
                description: 'should be thrown an error when member requests to delete the owner',
                authProfileMock: stubOne(Profile, {
                    id: 1,
                    roles: [Role.MEMBER]
                }),
                deleteProfileMock: stubOne(Profile, {
                    id: 2,
                    roles: [Role.OWNER]
                }),
                expectedThrow: true
            }
        ].forEach(function({
            description,
            authProfileMock,
            deleteProfileMock,
            expectedThrow
        }) {
            it(description, () => {

                if (expectedThrow) {

                    expect(() => service.validateDeleteProfilePermission(
                        authProfileMock,
                        deleteProfileMock
                    )).throws(ForbiddenException);
                } else {
                    expect(() => service.validateDeleteProfilePermission(
                        authProfileMock,
                        deleteProfileMock
                    )).not.throws();
                }
            });

        });
    });
});
