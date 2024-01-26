import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/utils/util.service';
import { TeamSetting } from '@entities/teams/team-setting.entity';
import { AlreadyUsedInWorkspace } from '@exceptions/users/already-used-in-workspace.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { TeamSettingService } from './team-setting.service';

describe('TeamSettingService', () => {
    let module: TestingModule;

    let service: TeamSettingService;
    let teamSettingRepositoryStub: sinon.SinonStubbedInstance<Repository<TeamSetting>>;

    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    before(async () => {
        teamSettingRepositoryStub = sinon.createStubInstance<Repository<TeamSetting>>(Repository);

        utilServiceStub = sinon.createStubInstance(UtilService);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

        module = await Test.createTestingModule({
            providers: [
                TeamSettingService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(TeamSetting),
                    useValue: teamSettingRepositoryStub
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                }
            ]
        }).compile();

        service = module.get<TeamSettingService>(TeamSettingService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Team Setting CRUD', () => {
        afterEach(() => {
            teamSettingRepositoryStub.findOneOrFail.reset();
            teamSettingRepositoryStub.update.reset();
        });

        [
            {
                description: 'should be searched workspace when workspace is actually exist',
                expectedLength: 1
            },
            {
                description: 'should be not searched workspace when workspace is actually not exist',
                expectedLength: 0
            }
        ].forEach(({ description, expectedLength }) => {
            it(description, async () => {
                const teamSettingListStub = stub(TeamSetting, expectedLength);
                const workspaceMock = 'fakeWorkspace';

                teamSettingRepositoryStub.findBy.resolves(teamSettingListStub);

                const searchedTeamSettings = await firstValueFrom(
                    service.search({
                        workspace: workspaceMock
                    })
                );

                expect(searchedTeamSettings).ok;
                expect(searchedTeamSettings.length).equals(expectedLength);
            });
        });
    });

    describe('Test getting team workspace status', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            syncdayRedisServiceStub.getWorkspaceStatus.reset();

            serviceSandbox.restore();
        });

        it('should be got status of team workspace', async () => {
            const workspaceMock = 'mysyncdayworkspace';
            syncdayRedisServiceStub.getWorkspaceStatus.resolves(true);
            const result = await service.fetchTeamWorkspaceStatus(workspaceMock);

            expect(syncdayRedisServiceStub.getWorkspaceStatus.called).true;

            expect(result).true;
        });
    });

    describe('Test creating team setting', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            teamSettingRepositoryStub.create.reset();
            teamSettingRepositoryStub.save.reset();
            teamSettingRepositoryStub.update.reset();

            syncdayRedisServiceStub.getWorkspaceStatus.reset();
            syncdayRedisServiceStub.setWorkspaceStatus.reset();

            serviceSandbox.restore();
        });

        it('should be created a team setting', async () => {

            const teamSettingMockStub = stubOne(TeamSetting);

            teamSettingRepositoryStub.create.returns(teamSettingMockStub);
            teamSettingRepositoryStub.save.resolves(teamSettingMockStub);

            await service._create(
                datasourceMock as unknown as EntityManager,
                teamSettingMockStub
            );

            expect(teamSettingRepositoryStub.create.called).true;
            expect(teamSettingRepositoryStub.save.called).true;
            expect(teamSettingRepositoryStub.update.called).true;
            expect(syncdayRedisServiceStub.setWorkspaceStatus.called).true;
        });
    });

    describe('Test updating team setting', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            teamSettingRepositoryStub.findOneByOrFail.reset();
            teamSettingRepositoryStub.update.reset();
            syncdayRedisServiceStub.getWorkspaceStatus.reset();
            syncdayRedisServiceStub.deleteWorkspaceStatus.reset();
            syncdayRedisServiceStub.setWorkspaceStatus.reset();

            serviceSandbox.restore();
        });

        it('should be patched for team setting', async () => {
            const teamIdMock = 123;

            const teamSettingMock = stubOne(TeamSetting);

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            teamSettingRepositoryStub.update.resolves(updateResultStub);

            const updateResult = await firstValueFrom(service.patch(teamIdMock, teamSettingMock));
            expect(updateResult).ok;
            expect(teamSettingRepositoryStub.update.called).true;
        });

        it('should be updated with single transaction', async () => {
            const teamSettingStub = stubOne(TeamSetting);
            const teamIdMock = 123;
            const newWorkspaceMock = 'mysyncdayworkspace';

            teamSettingRepositoryStub.findOneByOrFail.resolves(teamSettingStub);

            serviceSandbox.stub(service, '_updateTeamWorkspace').resolves(true);

            const result = await service.updateTeamWorkspace(teamIdMock, newWorkspaceMock);
            expect(teamSettingRepositoryStub.findOneByOrFail.called).true;
            expect(result).ok;
        });

        it('should be updated team workspace', async () => {
            const userIdMock = 123;
            const previousWorkspace = stubOne(TeamSetting).workspace;
            const workspaceMock = 'mysyncdayworkspace';

            const _updateTeamWorkspaceRecordStub = serviceSandbox.stub(service, '_updateTeamWorkspaceRecord').resolves(true);

            const result = await service._updateTeamWorkspace(
                datasourceMock as EntityManager,
                userIdMock,
                previousWorkspace,
                workspaceMock
            );

            expect(result).true;
            expect(teamSettingRepositoryStub.update.called).true;
            expect(_updateTeamWorkspaceRecordStub.called).true;
        });

        it('should be not updated workspace record when team workspace was already used in', async () => {

            const previousWorkspaceMock = 'oldWorkspace';
            const newWorkspaceMock = 'mysyncdayworkspace';

            syncdayRedisServiceStub.getWorkspaceStatus.resolves(true);
            syncdayRedisServiceStub.deleteWorkspaceStatus.resolves();
            syncdayRedisServiceStub.setWorkspaceStatus.resolves();

            await expect(service._updateTeamWorkspaceRecord(
                previousWorkspaceMock,
                newWorkspaceMock
            )).rejectedWith(AlreadyUsedInWorkspace);
            expect(syncdayRedisServiceStub.getWorkspaceStatus.called).true;
            expect(syncdayRedisServiceStub.deleteWorkspaceStatus.called).false;
            expect(syncdayRedisServiceStub.setWorkspaceStatus.called).false;
        });

        it('should be updated team workspace for redis record', async () => {
            const previousWorkspaceMock = 'oldWorkspace';
            const newWorkspaceMock = 'mysyncdayworkspace';

            syncdayRedisServiceStub.getWorkspaceStatus.resolves(false);
            syncdayRedisServiceStub.deleteWorkspaceStatus.resolves(true);
            syncdayRedisServiceStub.setWorkspaceStatus.resolves(true);

            const result = await service._updateTeamWorkspaceRecord(
                previousWorkspaceMock,
                newWorkspaceMock
            );
            expect(syncdayRedisServiceStub.getWorkspaceStatus.called).true;
            expect(syncdayRedisServiceStub.deleteWorkspaceStatus.called).true;
            expect(syncdayRedisServiceStub.setWorkspaceStatus.called).true;

            expect(result).true;
        });

        it('should be updated team workspace without workspace delete for new redis record', async () => {
            const previousWorkspaceMock = null;
            const newWorkspaceMock = 'mysyncdayworkspace';

            syncdayRedisServiceStub.getWorkspaceStatus.resolves(false);
            syncdayRedisServiceStub.deleteWorkspaceStatus.resolves(true);
            syncdayRedisServiceStub.setWorkspaceStatus.resolves(true);

            const result = await service._updateTeamWorkspaceRecord(
                previousWorkspaceMock,
                newWorkspaceMock
            );
            expect(syncdayRedisServiceStub.getWorkspaceStatus.called).true;
            expect(syncdayRedisServiceStub.deleteWorkspaceStatus.called).false;
            expect(syncdayRedisServiceStub.setWorkspaceStatus.called).true;

            expect(result).true;
        });
    });

    describe('Team Setting Delete Test', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            utilServiceStub.generateUUID.reset();

            teamSettingRepositoryStub.update.reset();
            teamSettingRepositoryStub.softDelete.reset();

            teamSettingRepositoryStub.findOneOrFail.reset();

            syncdayRedisServiceStub.deleteWorkspaceStatus.reset();

            serviceSandbox.restore();
        });

        it('should be deleted the team setting', async () => {
            const teamSettingStub = stubOne(TeamSetting);
            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            utilServiceStub.generateUUID.returns('fakeuuid');

            teamSettingRepositoryStub.update.resolves(updateResultStub);
            teamSettingRepositoryStub.softDelete.resolves(updateResultStub);

            teamSettingRepositoryStub.findOneOrFail.resolves(teamSettingStub);

            syncdayRedisServiceStub.deleteWorkspaceStatus.resolves(true);

            const deleteResult = await firstValueFrom(service._delete(datasourceMock as EntityManager, teamSettingStub.id));

            expect(deleteResult).true;
            expect(utilServiceStub.generateUUID.called).true;

            expect(teamSettingRepositoryStub.update.called).true;
            expect(teamSettingRepositoryStub.softDelete.called).true;

            expect(teamSettingRepositoryStub.findOneOrFail.called).true;

            expect(syncdayRedisServiceStub.deleteWorkspaceStatus.called).true;
        });
    });
});
