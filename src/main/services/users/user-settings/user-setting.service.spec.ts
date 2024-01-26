import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSetting } from '@entities/users/user-setting.entity';
import { PatchUserSettingRequestDto } from '@dto/users/user-settings/patch-user-setting-request.dto';
import { TestMockUtil } from '@test/test-mock-util';
import { UserSettingService } from './user-setting.service';

describe('UserSettingService', () => {
    let module: TestingModule;

    let service: UserSettingService;
    let userSettingRepositoryStub: sinon.SinonStubbedInstance<Repository<UserSetting>>;

    beforeEach(async () => {
        userSettingRepositoryStub = sinon.createStubInstance<Repository<UserSetting>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                UserSettingService,
                {
                    provide: getRepositoryToken(UserSetting),
                    useValue: userSettingRepositoryStub
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

            await service.patchUserSettingByUserId(userSettingMock.userId, userSettingMock as unknown as PatchUserSettingRequestDto);

            expect(userSettingRepositoryStub.update.called).true;
        });
    });
});
