import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { calendar_v3 } from 'googleapis';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { GoogleCalendarScheduleBody } from '@core/interfaces/integrations/google/google-calendar-schedule-body.interface';
import { GoogleOAuth2UserWithToken } from '@core/interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { User } from '@entity/users/user.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
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

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            googleIntegrationFacadeStub.fetchGoogleUsersWithToken.reset();
            userServiceStub.findUserByEmail.reset();
            userServiceStub.createUserByGoogleOAuth2.reset();

            googleIntegrationsServiceStub.create.reset();
            googleConverterServiceStub.convertToGoogleCalendarIntegration.reset();

            serviceSandbox.restore();
        });

        [
            {
                description: 'should be issued token for google oauth sign up user',
                integratinoContext: IntegrationContext.SIGN_UP,
                googleOAuth2UserWithToken: {
                    googleUser: {
                        email: 'fakeEmail',
                        name: 'fakeName'
                    },
                    calendars: {
                        items: [
                            { primary: true, timeZone: 'Asia/Seoul' }
                        ]
                    } as calendar_v3.Schema$CalendarList,
                    schedules: {
                        'primary': []
                    } as GoogleCalendarScheduleBody,
                    tokens: {} as OAuthToken,
                    insufficientPermission: false
                } as GoogleOAuth2UserWithToken,
                getFindUserStub: () => null,
                isExpectedNewbie: true,
                createUserByGoogleOAuth2Call: true,
                googleIntegrationServiceCreateCall: false
            },
            {
                description: 'should be issued token for google oauth sign in user',
                integratinoContext: IntegrationContext.SIGN_IN,
                googleOAuth2UserWithToken: {
                    googleUser: {
                        email: 'fakeEmail',
                        name: 'fakeName'
                    },
                    calendars: {
                        items: [
                            { primary: true, timeZone: 'Asia/Seoul' }
                        ]
                    } as calendar_v3.Schema$CalendarList,
                    schedules: {
                        'primary': []
                    } as GoogleCalendarScheduleBody,
                    tokens: {} as OAuthToken,
                    insufficientPermission: false
                } as GoogleOAuth2UserWithToken,
                getFindUserStub: () => stubOne(User, {
                    googleIntergrations: []
                }),
                isExpectedNewbie: false,
                createUserByGoogleOAuth2Call: false,
                googleIntegrationServiceCreateCall: true
            },
            {
                description: 'should be issued token for google oauth sign in user with google integration creating',
                integratinoContext: IntegrationContext.SIGN_IN,
                googleOAuth2UserWithToken: {
                    googleUser: {
                        email: 'fakeEmail',
                        name: 'fakeName'
                    },
                    calendars: {
                        items: [
                            { primary: true, timeZone: 'Asia/Seoul' }
                        ]
                    } as calendar_v3.Schema$CalendarList,
                    schedules: {
                        'primary': []
                    } as GoogleCalendarScheduleBody,
                    tokens: {} as OAuthToken,
                    insufficientPermission: false
                } as GoogleOAuth2UserWithToken,
                getFindUserStub: () => stubOne(User, {
                    googleIntergrations: stub(GoogleIntegration)
                }),
                isExpectedNewbie: false,
                createUserByGoogleOAuth2Call: false,
                googleIntegrationServiceCreateCall: false
            },
            {
                description: 'should be issued token with google integration for already signed up user',
                integratinoContext: IntegrationContext.INTEGRATE,
                googleOAuth2UserWithToken: {
                    googleUser: {
                        email: 'fakeEmail',
                        name: 'fakeName'
                    },
                    calendars: {
                        items: [
                            { primary: true, timeZone: 'Asia/Seoul' }
                        ]
                    } as calendar_v3.Schema$CalendarList,
                    schedules: {
                        'primary': []
                    } as GoogleCalendarScheduleBody,
                    tokens: {} as OAuthToken,
                    insufficientPermission: false
                } as GoogleOAuth2UserWithToken,
                getFindUserStub: () => stubOne(User, {
                    googleIntergrations: []
                }),
                isExpectedNewbie: false,
                createUserByGoogleOAuth2Call: false,
                googleIntegrationServiceCreateCall: true
            },
            {
                description: 'should be issued token if the user already has Google integration associated with the same email, a new integration should not be created.',
                integratinoContext: IntegrationContext.INTEGRATE,
                googleOAuth2UserWithToken: {
                    googleUser: {
                        email: 'fakeEmail',
                        name: 'fakeName'
                    },
                    calendars: {
                        items: [
                            { primary: true, timeZone: 'Asia/Seoul' }
                        ]
                    } as calendar_v3.Schema$CalendarList,
                    schedules: {
                        'primary': []
                    } as GoogleCalendarScheduleBody,
                    tokens: {} as OAuthToken,
                    insufficientPermission: false
                } as GoogleOAuth2UserWithToken,
                getFindUserStub: () => stubOne(User, {
                    email: 'fakeEmail',
                    googleIntergrations: [stubOne(GoogleIntegration, {
                        email: 'fakeEmail'
                    })]
                }),
                isExpectedNewbie: false,
                createUserByGoogleOAuth2Call: false,
                googleIntegrationServiceCreateCall: false
            }
        ].forEach(function({
            description,
            integratinoContext,
            googleOAuth2UserWithToken,
            getFindUserStub,
            isExpectedNewbie,
            createUserByGoogleOAuth2Call,
            googleIntegrationServiceCreateCall
        }) {

            it(description, async () => {
                const createUserStub = stubOne(User);
                const userSettingMock = stubOne(UserSetting);
                const languageDummy = userSettingMock.preferredLanguage;
                const authorizationCodeMock = faker.datatype.uuid();
                const findUserStub = getFindUserStub();

                const timezoneDummy = 'faketimezone';

                googleIntegrationFacadeStub.fetchGoogleUsersWithToken.resolves(googleOAuth2UserWithToken);

                userServiceStub.findUserByEmail.resolves(findUserStub);
                userServiceStub.createUserByGoogleOAuth2.resolves(createUserStub);

                const issuedTokenStub: CreateTokenResponseDto = {
                    accessToken: 'fakeJwtToken',
                    refreshToken: 'fakeRefreshToken'
                };

                serviceSandbox.stub(service, 'issueToken').returns(issuedTokenStub);

                const { issuedToken, isNewbie, insufficientPermission } = await service.issueTokenByGoogleOAuth(
                    authorizationCodeMock,
                    timezoneDummy,
                    integratinoContext,
                    createUserStub.email,
                    languageDummy
                );

                expect(issuedToken).ok;
                expect(isNewbie).equals(isExpectedNewbie);
                expect(insufficientPermission).equals(googleOAuth2UserWithToken.insufficientPermission);

                expect(googleIntegrationFacadeStub.fetchGoogleUsersWithToken.called).true;
                expect(userServiceStub.findUserByEmail.called).true;
                expect(userServiceStub.createUserByGoogleOAuth2.called).equals(createUserByGoogleOAuth2Call);
                expect(googleIntegrationsServiceStub.create.called).equals(googleIntegrationServiceCreateCall);
                expect(googleConverterServiceStub.convertToGoogleCalendarIntegration.called).true;
            });
        });

    });
});
