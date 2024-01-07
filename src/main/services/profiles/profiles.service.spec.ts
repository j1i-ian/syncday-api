import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, FindOptionsWhere, Repository, SelectQueryBuilder } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, of } from 'rxjs';
import { ForbiddenException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Role } from '@interfaces/profiles/role.enum';
import { ProfileSearchOption } from '@interfaces/profiles/profile-search-option.interface';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { UserService } from '@services/users/user.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { UtilService } from '@services/util/util.service';
import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';
import { User } from '@entity/users/user.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { ProfilesService } from './profiles.service';

const testMockUtil = new TestMockUtil();

describe('ProfilesService', () => {
    let service: ProfilesService;

    let module: TestingModule;

    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let notificationServiceStub: sinon.SinonStubbedInstance<NotificationsService>;

    let profilesRedisRepositoryStub: sinon.SinonStubbedInstance<ProfilesRedisRepository>;

    let profileRepositoryStub: sinon.SinonStubbedInstance<Repository<Profile>>;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    before(async () => {

        utilServiceStub = sinon.createStubInstance(UtilService);
        userServiceStub = sinon.createStubInstance(UserService);
        notificationServiceStub = sinon.createStubInstance(NotificationsService);

        profilesRedisRepositoryStub = sinon.createStubInstance<ProfilesRedisRepository>(ProfilesRedisRepository);

        profileRepositoryStub = sinon.createStubInstance<Repository<Profile>>(Repository);

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

    describe.only('Profile Filter Text', () => {
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
                convertToInvitedNewTeamMemberCall: false
            }

        ].forEach(function({
            description,
            getInvitedNewTeamMemberMocks,
            getNewInvitationTeamMemberMocks,
            getAlreadyJoinedTeamProfilesMock,
            convertToInvitedNewTeamMemberCall
        }) {

            it(description, async () => {

                const teamIdMock = stubOne(Team).id;

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
                        newInvitationTeamMemberMocks
                    )
                );

                expect(alreadySentInvitations).ok;
                expect(alreadySentInvitations.length).greaterThan(0);

                expect(profilesRedisRepositoryStub.filterAlreadyInvited.called).true;
                expect(utilServiceStub.convertToInvitedNewTeamMember.called).equals(convertToInvitedNewTeamMemberCall);

                expect(profileQueryBuilderStub.getMany.called).true;
            });

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
    });

    describe('Test creating a profile for invitation', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

        });

        afterEach(() => {

            userServiceStub.search.reset();

            notificationServiceStub.sendTeamInvitationForNewUsers.reset();

            serviceSandbox.restore();
        });

        [
            {
                description: 'should be created a profile as invitation for sync user',
                createInvitedProfilesCall: true,
                sendTeamInvitationForNewUsersCall: false,
                getSearchedUserStubs: () => {
                    const syncUserStub = stubOne(User);
                    return [ syncUserStub ];
                }
            },
            {
                description: 'should be created a profile as invitation for new user',
                createInvitedProfilesCall: false,
                sendTeamInvitationForNewUsersCall: true,
                getSearchedUserStubs: () => []
            }
        ].forEach(function({
            description,
            createInvitedProfilesCall,
            sendTeamInvitationForNewUsersCall,
            getSearchedUserStubs
        }) {

            it(description, async () => {

                const invitiedNewUserMock = stubOne(User);
                const teamIdMock = stubOne(Team).id;
                const profileStub = stubOne(Profile);
                const userStubs = getSearchedUserStubs();

                userServiceStub.search.resolves(userStubs);

                const saveInvitedNewTeamMemberStub = serviceSandbox.stub(
                    service,
                    'saveInvitedNewTeamMember'
                ).returns(of(true));

                const createInvitedProfilesStub = serviceSandbox.stub(
                    service,
                    'createInvitedProfiles'
                ).returns(of([profileStub]));

                notificationServiceStub.sendTeamInvitationForNewUsers.returns(of(true));

                const createdProfile = await firstValueFrom(
                    service.create(
                        teamIdMock,
                        invitiedNewUserMock
                    )
                );

                expect(createdProfile).ok;
                expect(userServiceStub.search.called).true;
                expect(saveInvitedNewTeamMemberStub.called).true;
                expect(createInvitedProfilesStub.called).equals(createInvitedProfilesCall);
                expect(notificationServiceStub.sendTeamInvitationForNewUsers.called).equals(sendTeamInvitationForNewUsersCall);
            });
        });

    });

    describe('Test creating profile with transaction', () => {

        afterEach(() => {
            profileRepositoryStub.create.reset();
            profileRepositoryStub.save.reset();

            profilesRedisRepositoryStub.getInvitedTeamIds.reset();
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

        it('should be created invited profiles', async () => {
            const userMock = stubOne(User);
            const teamIdMocks = stub(Team).map((_team) => _team.id);

            profilesRedisRepositoryStub.getInvitedTeamIds.returns(of(teamIdMocks));

            profileRepositoryStub.create.returnsArg(0);
            profileRepositoryStub.save.resolvesArg(0);

            const createdProfiles = await firstValueFrom(service.createInvitedProfiles(
                userMock
            ));

            expect(createdProfiles).ok;
            expect(createdProfiles.length).greaterThan(0);

            expect(profileRepositoryStub.create.called).true;
            expect(profileRepositoryStub.save.called).true;
            expect(profilesRedisRepositoryStub.getInvitedTeamIds.called).true;
        });
    });

    describe('Test check duplicated invitation', () => {

        afterEach(() => {
            profilesRedisRepositoryStub.getInvitedTeamIds.reset();
        });

        it('should be invited user', async () => {
            const invitedTeamIdsStub = stub(Team).map((team) => team.id);
            const teamIdMock = invitedTeamIdsStub[0];

            const userMock = stubOne(User);

            profilesRedisRepositoryStub.getInvitedTeamIds.returns(of(invitedTeamIdsStub));

            const result = await firstValueFrom(service.checkAlreadyInvited(
                userMock,
                teamIdMock
            ));

            expect(result).true;
            expect(profilesRedisRepositoryStub.getInvitedTeamIds.called).true;
        });

        it('should be not invited user if he has been invited alerady', async () => {
            const invitedTeamIdsStub = stub(Team).map((team) => team.id);
            const teamIdMock = invitedTeamIdsStub.pop() as number;

            const userMock = stubOne(User);

            profilesRedisRepositoryStub.getInvitedTeamIds.returns(of(invitedTeamIdsStub));

            const result = await firstValueFrom(service.checkAlreadyInvited(
                userMock,
                teamIdMock
            ));

            expect(result).false;
            expect(profilesRedisRepositoryStub.getInvitedTeamIds.called).true;
        });
    });

    it('coverage fill: saveInvitedNewTeamMember', async () => {
        const teamIdMock = stubOne(Team).id;
        const invitedNewTeamMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock);

        profilesRedisRepositoryStub.setInvitedNewTeamMembers.returns(of(true));

        const saveSuccess = await firstValueFrom(service.saveInvitedNewTeamMember(teamIdMock, invitedNewTeamMemberMocks));

        expect(saveSuccess).true;
        expect(profilesRedisRepositoryStub.setInvitedNewTeamMembers.called).true;

        profilesRedisRepositoryStub.setInvitedNewTeamMembers.reset();
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
        profilesRedisRepositoryStub.deleteTeamInvitations.returns(of(true));

        const userMock = stubOne(User);

        await firstValueFrom(service.completeInvitation(userMock));

        expect(profilesRedisRepositoryStub.deleteTeamInvitations.calledTwice).true;

        profilesRedisRepositoryStub.deleteTeamInvitations.reset();
    });

    describe('Test Profile Delete', () => {
        it('should be removed a profile for kick a user from the team', async () => {

            const teamIdMock = stubOne(Team).id;
            const profileIdMock = stubOne(Profile).id;

            const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

            profileRepositoryStub.delete.resolves(deleteResultStub);

            await firstValueFrom(service.remove(
                teamIdMock,
                profileIdMock
            ));
        });
    });

    describe('Test validate a role update rqeuest', () => {

        afterEach(() => {
            utilServiceStub.isValidRoleUpdateRequest.reset();
        });

        it('should be passed the validation when request is valid', () => {

            const authRolesMock = [Role.OWNER];
            const targetRolesMock = [Role.OWNER];

            const roleUpdateRequestValidStub = true;
            utilServiceStub.isValidRoleUpdateRequest.returns(roleUpdateRequestValidStub);

            expect(() => service.validateRoleUpdateRequest(
                authRolesMock,
                targetRolesMock
            )).not.throw();

            expect(utilServiceStub.isValidRoleUpdateRequest.called).true;
        });

        it('should be thrown an forbidden exception for invalid request', () => {

            const authRolesMock = [Role.MANAGER];
            const targetRolesMock = [Role.OWNER];

            const roleUpdateRequestInvalidStub = false;
            utilServiceStub.isValidRoleUpdateRequest.returns(roleUpdateRequestInvalidStub);

            expect(() => service.validateRoleUpdateRequest(
                authRolesMock,
                targetRolesMock
            )).throw(ForbiddenException);

            expect(utilServiceStub.isValidRoleUpdateRequest.called).true;
        });
    });

    it('should be completed a invitation for new user', async () => {
        profilesRedisRepositoryStub.deleteTeamInvitations.returns(of(true));

        const userMock = stubOne(User);

        await firstValueFrom(service.completeInvitation(userMock));

        expect(profilesRedisRepositoryStub.deleteTeamInvitations.calledTwice).true;

        profilesRedisRepositoryStub.deleteTeamInvitations.reset();
    });
});
