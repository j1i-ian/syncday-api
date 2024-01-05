import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, of } from 'rxjs';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@interfaces/profiles/role.enum';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { UserService } from '@services/users/user.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';
import { User } from '@entity/users/user.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { ProfilesService } from './profiles.service';

const testMockUtil = new TestMockUtil();

describe('ProfilesService', () => {
    let service: ProfilesService;

    let module: TestingModule;

    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let notificationServiceStub: sinon.SinonStubbedInstance<NotificationsService>;

    let profilesRedisRepositoryStub: sinon.SinonStubbedInstance<ProfilesRedisRepository>;

    let profileRepositoryStub: sinon.SinonStubbedInstance<Repository<Profile>>;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    before(async () => {

        userServiceStub = sinon.createStubInstance(UserService);
        notificationServiceStub = sinon.createStubInstance(NotificationsService);

        profilesRedisRepositoryStub = sinon.createStubInstance<ProfilesRedisRepository>(ProfilesRedisRepository);

        profileRepositoryStub = sinon.createStubInstance<Repository<Profile>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                ProfilesService,
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
                }
            ]
        }).compile();

        service = module.get<ProfilesService>(ProfilesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test profile fetching', () => {

        afterEach(() => {
            profileRepositoryStub.findOneOrFail.reset();
            profileRepositoryStub.find.reset();
        });

        it('should be searched profiles by team id', async () => {
            const teamIdMock = stubOne(Team).id;
            const profileStubs = stub(Profile);

            profileRepositoryStub.find.resolves(profileStubs);

            const loadedProfiles =  await firstValueFrom(service.searchByTeamId(teamIdMock));

            expect(loadedProfiles).ok;
            expect(loadedProfiles.length).greaterThan(0);
            expect(profileRepositoryStub.find.called).true;
        });

        it('should be searched profiles by user id', async () => {
            const userIdMock = stubOne(User).id;
            const profileStubs = stub(Profile);

            profileRepositoryStub.find.resolves(profileStubs);

            const loadedProfiles =  await firstValueFrom(service.searchByUserId({
                userId: userIdMock
            }));

            expect(loadedProfiles).ok;
            expect(loadedProfiles.length).greaterThan(0);
            expect(profileRepositoryStub.find.called).true;
        });

        it('should be found profile by profile id', async () => {
            const profileStub = stubOne(Profile);

            profileRepositoryStub.findOneOrFail.resolves(profileStub);

            const loadedUser =  await firstValueFrom(service.findProfile({
                profileId: profileStub.id
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

            userServiceStub.searchByEmailOrPhone.reset();

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

                userServiceStub.searchByEmailOrPhone.resolves(userStubs);

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
                expect(userServiceStub.searchByEmailOrPhone.called).true;
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

            profilesRedisRepositoryStub.getInvitedTeamIds.resolves(teamIdMocks);

            profileRepositoryStub.create.returnsArg(0);
            profileRepositoryStub.save.resolvesArg(0);

            const createdProfiles = await firstValueFrom(service.createInvitedProfiles(
                userMock
            ));

            expect(createdProfiles).ok;
            expect(createdProfiles.length).greaterThan(0);

            expect(profileRepositoryStub.create.called).true;
            expect(profileRepositoryStub.save.called).true;
            expect(profilesRedisRepositoryStub.getInvitedTeamIds.calledTwice).true;
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

    it('should be patched for profile', async () => {
        const profileIdMock = 123;

        const profileMock = stubOne(Profile);

        const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

        profileRepositoryStub.update.resolves(updateResultStub);

        const updateResult = await firstValueFrom(service.patch(profileIdMock, profileMock));
        expect(updateResult).ok;
        expect(profileRepositoryStub.update.called).true;
    });

    describe('Update profile roles', () => {

        afterEach(() => {
            profileRepositoryStub.findOneByOrFail.reset();
            profileRepositoryStub.update.reset();
        });

        it('should be updated the role to manager by manager for member', async () => {

            const profileMock = stubOne(Profile, {
                roles: [Role.MEMBER, Role.MANAGER]
            });
            const targetProfileStub = stubOne(Profile, {
                roles: [Role.MEMBER]
            });
            const desireRoles = [Role.MANAGER];

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            profileRepositoryStub.findOneByOrFail.resolves(targetProfileStub);
            profileRepositoryStub.update.resolves(updateResultStub);

            const result = await firstValueFrom(service.updateRoles(
                profileMock.teamId,
                profileMock.id,
                profileMock.roles,
                targetProfileStub.id,
                desireRoles
            ));

            expect(result).ok;
            expect(profileRepositoryStub.findOneByOrFail.called).true;
            expect(profileRepositoryStub.update.called).true;
        });

        it('should be updated the role to owner by previous owner for member or manager', async () => {

            const profileMock = stubOne(Profile, {
                roles: [Role.MEMBER, Role.MANAGER, Role.OWNER]
            });
            const targetProfileStub = stubOne(Profile, {
                roles: [Role.MEMBER]
            });
            const desireRoles = [Role.OWNER];

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            profileRepositoryStub.findOneByOrFail.resolves(targetProfileStub);
            profileRepositoryStub.update.resolves(updateResultStub);

            const result = await firstValueFrom(service.updateRoles(
                profileMock.teamId,
                profileMock.id,
                profileMock.roles,
                targetProfileStub.id,
                desireRoles
            ));

            expect(result).ok;
            expect(profileRepositoryStub.findOneByOrFail.called).true;
            expect(profileRepositoryStub.update.calledTwice).true;
        });

        it('should be not updated as promote the role to owner by manager for manager', async () => {

            const profileMock = stubOne(Profile, {
                roles: [Role.MEMBER, Role.MANAGER]
            });
            const targetProfileStub = stubOne(Profile, {
                roles: [Role.MEMBER, Role.MANAGER]
            });
            const desireRoles = [Role.OWNER];

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            profileRepositoryStub.findOneByOrFail.resolves(targetProfileStub);
            profileRepositoryStub.update.resolves(updateResultStub);

            await expect(
                firstValueFrom(service.updateRoles(
                    profileMock.teamId,
                    profileMock.id,
                    profileMock.roles,
                    targetProfileStub.id,
                    desireRoles
                ))
            ).rejectedWith(ForbiddenException);
        });

        it('should be not updated as demote the role to manager by manager for owner', async () => {

            const profileMock = stubOne(Profile, {
                roles: [Role.MEMBER, Role.MANAGER]
            });
            const targetProfileStub = stubOne(Profile, {
                roles: [Role.MEMBER, Role.MANAGER, Role.OWNER]
            });
            const desireRoles = [Role.MEMBER, Role.MANAGER];

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            profileRepositoryStub.findOneByOrFail.resolves(targetProfileStub);
            profileRepositoryStub.update.resolves(updateResultStub);

            await expect(
                firstValueFrom(service.updateRoles(
                    profileMock.teamId,
                    profileMock.id,
                    profileMock.roles,
                    targetProfileStub.id,
                    desireRoles
                ))
            ).rejectedWith(ForbiddenException);
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

    it('should be completed a invitation for new user', async () => {
        profilesRedisRepositoryStub.deleteTeamInvitations.returns(of(true));

        const userMock = stubOne(User);

        await firstValueFrom(service.completeInvitation(userMock));

        expect(profilesRedisRepositoryStub.deleteTeamInvitations.calledTwice).true;

        profilesRedisRepositoryStub.deleteTeamInvitations.reset();
    });
});
