import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '@entity/users/user.entity';
import { UserService } from './user.service';

describe('Test User Service', () => {
    let module: TestingModule;

    let service: UserService;

    let userRepositoryStub: sinon.SinonStubbedInstance<Repository<User>>;

    before(async () => {
        userRepositoryStub = sinon.createStubInstance<Repository<User>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(User),
                    useValue: userRepositoryStub
                }
            ]
        }).compile();

        service = module.get<UserService>(UserService);
    });

    after(() => {
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test user finding', () => {
        it('should be found user by user id', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOneByOrFail.resolves(userStub);

            const loadedUser = await service.findUserById(userStub.id);

            const actualPassedParam = userRepositoryStub.findOneByOrFail.getCall(0)
                .args[0] as FindOptionsWhere<User>;
            expect(actualPassedParam.id).equals(userStub.id);

            expect(loadedUser).equal(userStub);
        });

        it('should be found user by email', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOneByOrFail.resolves(userStub);

            const loadedUser = await service.findUserById(userStub.id);

            const actualPassedParam = userRepositoryStub.findOneByOrFail.getCall(1)
                .args[0] as FindOptionsWhere<User>;
            expect(actualPassedParam.id).equals(userStub.id);

            expect(loadedUser).equal(userStub);
        });
    });
});
