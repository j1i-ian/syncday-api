import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { AlreadyUsedInWorkspace } from '@app/exceptions/users/already-used-in-workspace.exception';
import { TeamSettingService } from './team-setting.service';

describe('TeamSettingService', () => {
    let module: TestingModule;

    let service: TeamSettingService;
    let teamSettingRepositoryStub: sinon.SinonStubbedInstance<Repository<TeamSetting>>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    beforeEach(async () => {
        teamSettingRepositoryStub = sinon.createStubInstance<Repository<TeamSetting>>(Repository);
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
                    service.searchTeamSettings({
                        workspace: workspaceMock
                    })
                );

                expect(searchedTeamSettings).ok;
                expect(searchedTeamSettings.length).equals(expectedLength);
            });
        });
    });

    describe('Test getting team workspace status', () => {
        afterEach(() => {
            syncdayRedisServiceStub.getWorkspaceStatus.reset();
            syncdayRedisServiceStub.setWorkspaceStatus.reset();
        });

        it('should be got status of team workspace', async () => {
            const workspaceMock = 'mysyncdayworkspace';
            syncdayRedisServiceStub.getWorkspaceStatus.resolves(true);
            const result = await service.fetchTeamWorkspaceStatus(workspaceMock);

            expect(syncdayRedisServiceStub.getWorkspaceStatus.called).true;

            expect(result).true;
        });

        it('should be not set status when team workspace is already assigned', async () => {
            const teamIdMock = 123;
            const workspaceMock = 'mysyncdayworkspace';

            syncdayRedisServiceStub.getWorkspaceStatus.resolves(true);

            await expect(service.createTeamWorkspaceStatus(datasourceMock as EntityManager, teamIdMock, workspaceMock)).rejectedWith(AlreadyUsedInWorkspace);
        });

        it('should be set status of team workspace', async () => {
            const userIdMock = 123;
            const workspaceMock = 'mysyncdayworkspace';
            const teamSettingStub = stubOne(TeamSetting);

            syncdayRedisServiceStub.getWorkspaceStatus.resolves(false);

            teamSettingRepositoryStub.findOneByOrFail.resolves(teamSettingStub);

            syncdayRedisServiceStub.setWorkspaceStatus.resolves(true);

            const result = await service.createTeamWorkspaceStatus(datasourceMock as EntityManager, userIdMock, workspaceMock);

            expect(syncdayRedisServiceStub.deleteWorkspaceStatus.called).true;
            expect(teamSettingRepositoryStub.update.called).true;

            expect(syncdayRedisServiceStub.setWorkspaceStatus.called).true;

            expect(result).true;
        });
    });
});
