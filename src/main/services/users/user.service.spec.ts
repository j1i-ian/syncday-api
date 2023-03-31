import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '@entity/users/user.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
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
        afterEach(() => {
            userRepositoryStub.findOneByOrFail.reset();
            userRepositoryStub.findOneBy.reset();
        });

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

            userRepositoryStub.findOneBy.resolves(userStub);

            const loadedUser = await service.findUserByEmail(userStub.email);

            const actualPassedParam = userRepositoryStub.findOneBy.getCall(0)
                .args[0] as FindOptionsWhere<User>;
            expect(actualPassedParam.email).equals(userStub.email);

            expect(loadedUser).equal(userStub);
        });

        it('should be not found user by email when user is not exist', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOneBy.resolves(null);

            const loadedUser = await service.findUserByEmail(userStub.email);

            expect(loadedUser).null;
        });
    });

    describe('Test user sign up', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            userRepositoryStub.create.reset();
            userRepositoryStub.save.reset();

            serviceSandbox.reset();
        });

        after(() => {
            serviceSandbox.restore();
        });

        it('should be created user with email', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);

            const createdUser = await service.createUser(
                userStub as unknown as CreateUserRequestDto
            );

            expect(createdUser).ok;
            expect(createdUser.email).ok;
        });

        it('should be not created user with email when user is already exist', async () => {
            const alreadySignedUpUser = stubOne(User, {
                nickname: 'foo'
            });
            serviceSandbox.stub(service, 'findUserByEmail').resolves(alreadySignedUpUser);

            const userStub = stubOne(User, {
                nickname: 'bar'
            });

            await expect(
                service.createUser(userStub as unknown as CreateUserRequestDto)
            ).rejectedWith(BadRequestException);
        });
    });
});
