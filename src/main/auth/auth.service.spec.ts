import { Test, TestingModule } from '@nestjs/testing';
import * as bcryptModule from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
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

    it('should be validated email for issueing user auth token', async () => {
        const plainPassword = 'thisisUserPlainPassword';

        const userStub = stubOne(User, {
            hashedPassword: plainPassword
        });

        bcryptCompareSyncStub.returns(true);

        userServiceStub.findUserByEmail.resolves(userStub);

        const validationResult = await service.validateEmail(userStub.email, plainPassword);

        bcryptCompareSyncStub.reset();

        expect(validationResult).ok;
    });

    it('should be issued jwt token', () => {
        const userMock = stubOne(User);

        jwtServiceStub.sign.returns('signedUserTokenJwtTokenEncoded');

        const issuedToken = service.issueToken(userMock);

        expect(issuedToken).ok;
    });
});
