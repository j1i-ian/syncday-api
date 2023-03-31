import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '@services/users/user.service';
import { User } from '@entity/users/user.entity';
import { CreateTokenRequestDto } from '../dto/tokens/create-token-request.dto';
import { CreateTokenResponseDto } from '../dto/tokens/create-token-response.dto';
import { TokenService } from './token/token.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
    let service: AuthService;

    let tokenServiceStub: sinon.SinonStubbedInstance<TokenService>;

    let userServiceStub: sinon.SinonStubbedInstance<UserService>;

    before(async () => {
        tokenServiceStub = sinon.createStubInstance(TokenService);

        userServiceStub = sinon.createStubInstance(UserService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: TokenService,
                    useValue: tokenServiceStub
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

    it('should authorize user jwt token', async () => {
        const userStub = stubOne(User);

        const plainPassword = 'this!sPlainPassw0rd';
        const fakeSignedToken = 'signedUserTokenJwtTokenEncoded';
        const createTokenResponseDtoStub: CreateTokenResponseDto = {
            accessToken: fakeSignedToken,
            refreshToken: ''
        };

        const createTokenRequestDto: CreateTokenRequestDto = {
            email: userStub.email,
            plainPassword
        };

        userServiceStub.findUserByEmail.resolves(userStub);
        tokenServiceStub.issueToken.returns(createTokenResponseDtoStub);

        const createTokenResponseDto = await service.authorizeUserByEmail(createTokenRequestDto);

        expect(createTokenResponseDto).ok;
        expect(createTokenResponseDto.accessToken).ok;
        expect(createTokenResponseDto.refreshToken).not.ok;
    });
});
