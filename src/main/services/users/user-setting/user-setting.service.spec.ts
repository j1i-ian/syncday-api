import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
});
