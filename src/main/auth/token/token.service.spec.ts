import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Auth } from 'googleapis';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { User } from '@entity/users/user.entity';
import { CreateTokenResponseDto } from '@dto/tokens/create-token-response.dto';
import { GoogleIntegrationsService } from '../../services/integrations/google-integrations.service';
import { UserService } from '../../services/users/user.service';
import { IntegrationUtilService } from '../../services/util/integration-util/integraion-util.service';
import { faker } from '@faker-js/faker';
import { EnsuredGoogleOAuth2User, TokenService } from './token.service';

describe('TokenService', () => {
    let service: TokenService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let jwtServiceStub: sinon.SinonStubbedInstance<JwtService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let googleIntegrationServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationsService>;
    let integrationUtilServiceStub: sinon.SinonStubbedInstance<IntegrationUtilService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        jwtServiceStub = sinon.createStubInstance(JwtService);
        userServiceStub = sinon.createStubInstance(UserService);
        googleIntegrationServiceStub = sinon.createStubInstance(GoogleIntegrationsService);
        integrationUtilServiceStub = sinon.createStubInstance(IntegrationUtilService);

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
                    provide: GoogleIntegrationsService,
                    useValue: googleIntegrationServiceStub
                },
                {
                    provide: IntegrationUtilService,
                    useValue: integrationUtilServiceStub
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
            integrationUtilServiceStub.generateGoogleOauthClient.reset();
            integrationUtilServiceStub.issueGoogleTokenByAuthorizationCode.reset();
            integrationUtilServiceStub.getGoogleUserInfo.reset();
            userServiceStub.findUserByEmail.reset();
            userServiceStub.createUserByGoogleOAuth2.reset();
        });

        it('should be issued token for google oauth which newbie is true', async () => {
            const userStub = stubOne(User);
            const userSettingMock = stubOne(UserSetting);
            const languageMock = userSettingMock.preferredLanguage;
            const authorizationCodeMock = faker.datatype.uuid();

            const fakeOAuthClient = {} as Auth.OAuth2Client;
            const googleTokenStub: CreateTokenResponseDto = {
                accessToken: 'fakeGoogleAuthKey',
                refreshToken: 'fakeGoogleAuthRefreshKey'
            };
            const googleUserStub = {
                email: 'fakeEmail',
                name: 'fakeName'
            } as EnsuredGoogleOAuth2User;
            const issuedTokenStub: CreateTokenResponseDto = {
                accessToken: 'fakeJwtToken',
                refreshToken: 'fakeRefreshToken'
            };

            integrationUtilServiceStub.generateGoogleOauthClient.returns(fakeOAuthClient);
            integrationUtilServiceStub.issueGoogleTokenByAuthorizationCode.resolves(
                googleTokenStub
            );
            integrationUtilServiceStub.getGoogleUserInfo.resolves(googleUserStub);
            userServiceStub.findUserByEmail.resolves(null);
            userServiceStub.createUserByGoogleOAuth2.resolves(userStub);

            serviceSandbox.stub(service, 'issueToken').returns(issuedTokenStub);

            const { issuedToken } = await service.issueTokenByGoogleOAuth(
                authorizationCodeMock,
                languageMock
            );

            expect(issuedToken).ok;

            expect(integrationUtilServiceStub.generateGoogleOauthClient.called).true;
            expect(integrationUtilServiceStub.issueGoogleTokenByAuthorizationCode.called).true;
            expect(integrationUtilServiceStub.getGoogleUserInfo.called).true;
            expect(userServiceStub.findUserByEmail.called).true;
            expect(userServiceStub.createUserByGoogleOAuth2.called).true;
        });
    });
});
