import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcryptModule from 'bcrypt';
import { UserService } from '@services/users/user.service';
import { User } from '@entity/users/user.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
    let service: AuthService;

    let bcryptCompareSyncStub: sinon.SinonStub;

    let jwtServiceStub: sinon.SinonStubbedInstance<JwtService>;

    let userServiceStub: sinon.SinonStubbedInstance<UserService>;

    before(async () => {
        jwtServiceStub = sinon.createStubInstance(JwtService);

        userServiceStub = sinon.createStubInstance(UserService);

        bcryptCompareSyncStub = sinon.stub(bcryptModule, 'compareSync');

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: JwtService,
                    useValue: jwtServiceStub
                },
                {
                    provide: UserService,
                    useValue: userServiceStub
                }
            ]
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test email validation', () => {
        afterEach(() => {
            bcryptCompareSyncStub.reset();
            userServiceStub.findUserByEmail.reset();
        });

        it('should be passed email validation when user is exist', async () => {
            const plainPassword = 'thisisUserPlainPassword';

            const userStub = stubOne(User, {
                hashedPassword: plainPassword
            });

            bcryptCompareSyncStub.returns(true);

            userServiceStub.findUserByEmail.resolves(userStub);

            const validationResult = await service.validateEmail(userStub.email, plainPassword);

            bcryptCompareSyncStub.reset();

            expect(validationResult).true;
        });

        it('should be not passed email validation when user is not exist', async () => {
            const dummy = 'thisisUserPlainPassword';

            const userStub = stubOne(User);

            bcryptCompareSyncStub.returns(true);

            userServiceStub.findUserByEmail.resolves(null);

            const validationResult = await service.validateEmail(userStub.email, dummy);

            bcryptCompareSyncStub.reset();

            expect(validationResult).false;
        });
    });

    it('should be issued jwt token', () => {
        const userMock = stubOne(User);

        jwtServiceStub.sign.returns('signedUserTokenJwtTokenEncoded');

        const issuedToken = service.issueToken(userMock);

        expect(issuedToken).ok;
    });
});
