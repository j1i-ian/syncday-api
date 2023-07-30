import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { calendar_v3 } from 'googleapis';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { User } from '@entity/users/user.entity';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { GoogleOAuth2UserWithToken } from '@app/interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';
import { GoogleCalendarScheduleBody } from '@app/interfaces/integrations/google/google-calendar-schedule-body.interface';
import { UserService } from '../../services/users/user.service';
import { faker } from '@faker-js/faker';
import { TokenService } from './token.service';

describe('TokenService', () => {
    let service: TokenService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let jwtServiceStub: sinon.SinonStubbedInstance<JwtService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let googleIntegrationsServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationsService>;
    let googleIntegrationFacadeStub: sinon.SinonStubbedInstance<GoogleIntegrationFacade>;
    let googleConverterServiceStub: sinon.SinonStubbedInstance<GoogleConverterService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        jwtServiceStub = sinon.createStubInstance(JwtService);
        userServiceStub = sinon.createStubInstance(UserService);
        googleIntegrationsServiceStub = sinon.createStubInstance(GoogleIntegrationsService);
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
                    provide: GoogleIntegrationsService,
                    useValue: googleIntegrationsServiceStub
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
        expect(jwtServiceStub.sign.called).true;
        expect(jwtServiceStub.sign.calledTwice).true;
        expect(service).ok;

        jwtServiceStub.sign.reset();
    });

    describe('Test issueTokenByRefreshToken', () => {
        let serviceSandbox: sinon.SinonSandbox;

        before(() => {
            serviceSandbox = sinon.createSandbox();
        });

        after(() => {
            serviceSandbox.restore();
        });

        it('should be issued token by refresh token', () => {
            const userStub = stubOne(User);
            const fakeRefreshTokenMock = 'iamfakeRefreshToken';

            const issuedTokenStub: CreateTokenResponseDto = {
                accessToken: 'fakeJwtToken',
                refreshToken: 'fakeRefreshToken'
            };

            jwtServiceStub.verify.returns(userStub);

            const issueTokenStub = serviceSandbox.stub(service, 'issueToken').returns(issuedTokenStub);

            const signed = service.issueTokenByRefreshToken(fakeRefreshTokenMock);

            expect(issueTokenStub.called).true;
            expect(signed).ok;
            expect(signed.accessToken).equal(issuedTokenStub.accessToken);
            expect(signed.refreshToken).equal(issuedTokenStub.refreshToken);
        });
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
                googleUser: googleUserStub,
                calendars: {
                    items: [
                        { primary: true, timeZone: 'Asia/Seoul' }
                    ]
                } as calendar_v3.Schema$CalendarList,
                schedules: {
                    'primary': []
                } as GoogleCalendarScheduleBody,
                tokens: {} as OAuthToken
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
                IntegrationContext.SIGN_UP,
                userStub.email,
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
