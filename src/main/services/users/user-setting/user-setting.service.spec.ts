import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { UserSetting } from '@entity/users/user-setting.entity';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';
import { TestMockUtil } from '@test/test-mock-util';
import { UserSettingService } from './user-setting.service';

describe('UserSettingService', () => {
    let module: TestingModule;

    let service: UserSettingService;
    let userSettingRepositoryStub: sinon.SinonStubbedInstance<Repository<UserSetting>>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    beforeEach(async () => {
        userSettingRepositoryStub = sinon.createStubInstance<Repository<UserSetting>>(Repository);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

        module = await Test.createTestingModule({
            providers: [
                UserSettingService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(UserSetting),
                    useValue: userSettingRepositoryStub
                },
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                }
            ]
        }).compile();

        service = module.get<UserSettingService>(UserSettingService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test User Setting CRUD', () => {
        afterEach(() => {
            userSettingRepositoryStub.findOneOrFail.reset();
            userSettingRepositoryStub.update.reset();
        });

        [
            {
                description: 'should be searched workspace when workspace is actually exist',
                expectedLength: 1
            },
            {
                description: 'should be searched workspace when workspace is actually exist',
                expectedLength: 0
            }
        ].forEach(({ description, expectedLength }) => {
            it(description, async () => {
                const userSettingListStub = stub(UserSetting, expectedLength);
                const workspaceMock = 'fakeWorkspace';

                userSettingRepositoryStub.findBy.resolves(userSettingListStub);

                const searchedUserSettings = await firstValueFrom(
                    service.searchUserSettings({
                        workspace: workspaceMock
                    })
                );

                expect(searchedUserSettings).ok;
                expect(searchedUserSettings.length).equals(expectedLength);
            });
        });

        it('should be fetched user setting by user id', async () => {
            const userSettingStub = stubOne(UserSetting);

            userSettingRepositoryStub.findOneOrFail.resolves(userSettingStub);

            await service.fetchUserSettingByUserId(userSettingStub.userId);

            expect(userSettingRepositoryStub.findOneOrFail.called).true;
        });

        it('should be patched user setting', async () => {
            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();
            const userSettingMock = stubOne(UserSetting);

            userSettingRepositoryStub.update.resolves(updateResultStub);

            await service.patchUserSettingByUserId(userSettingMock.userId, userSettingMock);

            expect(userSettingRepositoryStub.update.called).true;
        });
    });

    describe('Test getting user workspace status', () => {
        afterEach(() => {
            syncdayRedisServiceStub.getWorkspaceStatus.reset();
            syncdayRedisServiceStub.setWorkspaceStatus.reset();
        });

        it('should be got status of user workspace', async () => {
            const workspaceMock = 'mysyncdayworkspace';
            syncdayRedisServiceStub.getWorkspaceStatus.resolves(true);
            const result = await service.fetchUserWorkspaceStatus(workspaceMock);

            expect(syncdayRedisServiceStub.getWorkspaceStatus.called).true;

            expect(result).true;
        });

        it('should be not set status when user workspace is already assigned', async () => {
            const userIdMock = 123;
            const workspaceMock = 'mysyncdayworkspace';

            syncdayRedisServiceStub.getWorkspaceStatus.resolves(true);

            await expect(service.createUserWorkspaceStatus(datasourceMock as EntityManager, userIdMock, workspaceMock)).rejectedWith(
                BadRequestException,
                'already used workspace'
            );
        });

        it('should be set status of user workspace', async () => {
            const userIdMock = 123;
            const workspaceMock = 'mysyncdayworkspace';
            const userSettingStub = stubOne(UserSetting);

            syncdayRedisServiceStub.getWorkspaceStatus.resolves(false);

            userSettingRepositoryStub.findOneByOrFail.resolves(userSettingStub);

            syncdayRedisServiceStub.setWorkspaceStatus.resolves(true);

            const result = await service.createUserWorkspaceStatus(datasourceMock as EntityManager, userIdMock, workspaceMock);

            expect(syncdayRedisServiceStub.deleteWorkspaceStatus.called).true;
            expect(userSettingRepositoryStub.update.called).true;

            expect(syncdayRedisServiceStub.setWorkspaceStatus.called).true;

            expect(result).true;
        });
    });
});
