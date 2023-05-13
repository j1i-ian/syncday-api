import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { User } from '@entity/users/user.entity';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { GoogleOAuth2UserWithToken } from '@app/interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { UserService } from '../../services/users/user.service';
import { faker } from '@faker-js/faker';
import { TokenService } from './token.service';

describe('TokenService', () => {
    let service: TokenService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let jwtServiceStub: sinon.SinonStubbedInstance<JwtService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let googleIntegrationFacadeStub: sinon.SinonStubbedInstance<GoogleIntegrationFacade>;
    let googleConverterServiceStub: sinon.SinonStubbedInstance<GoogleConverterService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        jwtServiceStub = sinon.createStubInstance(JwtService);
        userServiceStub = sinon.createStubInstance(UserService);
        googleIntegrationFacadeStub = sinon.createStubInstance(GoogleIntegrationFacade);
        googleConverterServiceStub = sinon.createStubInstance(GoogleConverterService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TokenService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: JwtService,
                    useValue: jwtServiceStub
                },
                {
                    provide: UserService,
                    useValue: userServiceStub
                },
                {
                    provide: GoogleIntegrationFacade,
                    useValue: googleIntegrationFacadeStub
                },
                {
                    provide: GoogleConverterService,
                    useValue: googleConverterServiceStub
                }
            ]
        }).compile();

        service = module.get<TokenService>(TokenService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be issued token', () => {
        const userMock = stubOne(User);
        const fakeTokenStub = 'iamfaketoken';

        jwtServiceStub.sign.returns(fakeTokenStub);

        const signed = service.issueToken(userMock);

        expect(signed).ok;
        expect(signed.accessToken).equal(fakeTokenStub);
        expect(service).ok;
    });

    describe('Test issueTokenByGoogleOAuth', () => {
        let serviceSandbox: sinon.SinonSandbox;

        before(() => {
            serviceSandbox = sinon.createSandbox();
        });

        after(() => {
            serviceSandbox.restore();
        });

        afterEach(() => {
            googleIntegrationFacadeStub.fetchGoogleUsersWithToken.reset();
            userServiceStub.findUserByEmail.reset();
            userServiceStub.createUserByGoogleOAuth2.reset();

            googleConverterServiceStub.convertToGoogleCalendarIntegration.reset();
        });

        it('should be issued token for google oauth which newbie is true', async () => {
            const userStub = stubOne(User);
            const userSettingMock = stubOne(UserSetting);
            const languageMock = userSettingMock.preferredLanguage;
            const authorizationCodeMock = faker.datatype.uuid();

            const googleUserStub = {
                email: 'fakeEmail',
                name: 'fakeName'
            };

            googleIntegrationFacadeStub.fetchGoogleUsersWithToken.resolves({
                googleUser: googleUserStub
            } as GoogleOAuth2UserWithToken);

            userServiceStub.findUserByEmail.resolves(null);
            userServiceStub.createUserByGoogleOAuth2.resolves(userStub);

            const issuedTokenStub: CreateTokenResponseDto = {
                accessToken: 'fakeJwtToken',
                refreshToken: 'fakeRefreshToken'
            };

            serviceSandbox.stub(service, 'issueToken').returns(issuedTokenStub);

            const { issuedToken } = await service.issueTokenByGoogleOAuth(
                authorizationCodeMock,
                languageMock
            );

            expect(issuedToken).ok;

            expect(googleIntegrationFacadeStub.fetchGoogleUsersWithToken.called).true;
            expect(userServiceStub.findUserByEmail.called).true;
            expect(userServiceStub.createUserByGoogleOAuth2.called).true;
            expect(googleConverterServiceStub.convertToGoogleCalendarIntegration.called).true;
        });
    });
});
