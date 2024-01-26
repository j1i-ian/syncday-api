import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@entities/users/user.entity';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';
import { TestMockUtil } from '@test/test-mock-util';
import { TemporaryUsersService } from './temporary-users.service';

const testMockUtil = new TestMockUtil();

describe('TemporaryUsersService', () => {
    let service: TemporaryUsersService;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    let userRepositoryStub: sinon.SinonStubbedInstance<Repository<User>>;

    beforeEach(async () => {
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

        userRepositoryStub = sinon.createStubInstance<Repository<User>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TemporaryUsersService,
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: userRepositoryStub
                }
            ]
        }).compile();

        service = module.get<TemporaryUsersService>(TemporaryUsersService);
    });

    describe('Test temporary user', () => {
        it('should be success when temp user is created successful', async () => {
            const tempUserMock = testMockUtil.getTemporaryUser();

            syncdayRedisServiceStub.saveTemporaryUser.resolves(true);

            const tempUserOrNull = await service.createTemporaryUser(
                tempUserMock,
                tempUserMock.language
            );

            expect(tempUserOrNull).ok;
        });

        it('should be not success when temp user is not success', async () => {
            const tempUserMock = testMockUtil.getTemporaryUser();

            syncdayRedisServiceStub.saveTemporaryUser.resolves(false);

            const tempUserOrNull = await service.createTemporaryUser(
                tempUserMock,
                tempUserMock.language
            );

            expect(tempUserOrNull).null;
        });
    });
});
