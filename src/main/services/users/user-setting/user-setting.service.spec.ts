import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSetting } from '../../../../@core/core/entities/users/user-setting.entity';
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
});
