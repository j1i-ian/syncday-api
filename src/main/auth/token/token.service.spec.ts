import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { calendar_v3 } from 'googleapis';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { GoogleCalendarScheduleBody } from '@core/interfaces/integrations/google/google-calendar-schedule-body.interface';
import { GoogleOAuth2UserWithToken } from '@core/interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { Language } from '@interfaces/users/language.enum';
import { UtilService } from '@services/util/util.service';
import { OAuth2TokenServiceLocator } from '@services/oauth2/oauth2-token.service-locator';
import { GoogleOAuth2TokenService } from '@services/oauth2/google-oauth2-token/google-oauth2-token.service';
import { User } from '@entity/users/user.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { UserService } from '../../services/users/user.service';
import { faker } from '@faker-js/faker';
import { TestMockUtil } from '@test/test-mock-util';
import { TokenService } from './token.service';

const testMockUtil = new TestMockUtil();

describe('TokenService', () => {
    let service: TokenService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let jwtServiceStub: sinon.SinonStubbedInstance<JwtService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let oauth2TokenServiceLocatorStub: sinon.SinonStubbedInstance<OAuth2TokenServiceLocator>;

    let oauth2TokenServiceStub: sinon.SinonStubbedInstance<GoogleOAuth2TokenService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        jwtServiceStub = sinon.createStubInstance(JwtService);
        utilServiceStub = sinon.createStubInstance(UtilService);
        userServiceStub = sinon.createStubInstance(UserService);
        oauth2TokenServiceLocatorStub = sinon.createStubInstance(OAuth2TokenServiceLocator);

        oauth2TokenServiceStub = sinon.createStubInstance(GoogleOAuth2TokenService);
        oauth2TokenServiceLocatorStub.get.returns(oauth2TokenServiceStub);

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
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: UserService,
                    useValue: userServiceStub
                },
                {
                    provide: OAuth2TokenServiceLocator,
                    useValue: oauth2TokenServiceLocatorStub
                }
            ]
        }).compile();

        service = module.get<TokenService>(TokenService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('coverage fill: generateOAuth2AuthoizationUrl', () => {

        const timezoneMock = 'Asia/Seoul';
        const accessTokenMock = 'accessTokenMock';

        oauth2TokenServiceStub.generateOAuth2AuthoizationUrl.returns('fakeAuthorizationUrl');

        const generatedURI = service.generateOAuth2AuthoizationUrl(
            IntegrationVendor.GOOGLE,
            IntegrationContext.INTEGRATE,
            timezoneMock,
            accessTokenMock
        );

        expect(generatedURI).ok;
        expect(oauth2TokenServiceStub.generateOAuth2AuthoizationUrl.called).true;
    });

    it('coverage fill: generateOAuth2RedirectURI', () => {

        const OAuth2TokenResponseStub = testMockUtil.getSyncdayOAuth2TokenResponseMock();

        oauth2TokenServiceStub.generateOAuth2RedirectURI.returns({
            OAuth2TokenResponseStub
        } as any);

        const generatedURI = service.generateOAuth2RedirectURI(
            IntegrationVendor.GOOGLE,
            OAuth2TokenResponseStub
        );

        expect(generatedURI).ok;
        expect(oauth2TokenServiceStub.generateOAuth2RedirectURI.called).true;
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


    describe('Test issueTokenByOAuth2', () => {
        let serviceSandbox: sinon.SinonSandbox;

        let evaluateIntegrationContextStub: sinon.SinonStub;
        let issueTokenStub: sinon.SinonStub;

        let _oauth2TokenServiceStub: sinon.SinonStubbedInstance<GoogleOAuth2TokenService>;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            _oauth2TokenServiceStub = serviceSandbox.createStubInstance(GoogleOAuth2TokenService);
            oauth2TokenServiceLocatorStub.get.returns(_oauth2TokenServiceStub);

            evaluateIntegrationContextStub = serviceSandbox.stub(service, 'evaluateIntegrationContext');
            issueTokenStub = serviceSandbox.stub(service, 'issueToken');
        });

        afterEach(() => {

            oauth2TokenServiceLocatorStub.get.reset();

            _oauth2TokenServiceStub.getOAuth2UserProfile.reset();
            _oauth2TokenServiceStub.getEmailFromOAuth2UserProfile.reset();

            userServiceStub.findUserByEmail.reset();

            _oauth2TokenServiceStub.signUpWithOAuth.reset();
            _oauth2TokenServiceStub.integrate.reset();
            _oauth2TokenServiceStub.multipleSocialSignIn.reset();

            serviceSandbox.restore();
        });

        // TODO: Write a spec for parameterized test for Kakaotalk
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
                signUpWithOAuthCall: true,
                integrateCall: false,
                multipleSocialSignInCall: false
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
                    oauth2Accounts: [],
                    googleIntergrations: []
                }),
                isExpectedNewbie: false,
                signUpWithOAuthCall: false,
                integrateCall: false,
                multipleSocialSignInCall: false
            },
            {
                description: 'should be issued token for google oauth sign in user without google integration creating',
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
                    oauth2Accounts: [],
                    googleIntergrations: []
                }),
                isExpectedNewbie: false,
                signUpWithOAuthCall: false,
                integrateCall: false,
                multipleSocialSignInCall: false
            },
            {
                description: 'should be issued token with google OAuth for already signed up user',
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
                    oauth2Accounts: [],
                    googleIntergrations: []
                }),
                isExpectedNewbie: false,
                signUpWithOAuthCall: false,
                integrateCall: true,
                multipleSocialSignInCall: false
            },
            {
                description: 'should be issued token if the user already has Google OAuth associated with the same email.',
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
                    oauth2Accounts: [
                        {
                            id: 1,
                            email: 'fakeEmail',
                            oauth2Type: OAuth2Type.GOOGLE
                        }
                    ] as OAuth2Account[],
                    googleIntergrations: [
                        {
                            id: 1,
                            email: 'fakeEmail'
                        }
                    ] as GoogleIntegration[]
                }),
                isExpectedNewbie: false,
                signUpWithOAuthCall: false,
                integrateCall: true,
                multipleSocialSignInCall: false
            }
        ].forEach(function({
            description,
            integratinoContext,
            googleOAuth2UserWithToken,
            getFindUserStub,
            isExpectedNewbie,
            signUpWithOAuthCall,
            integrateCall,
            multipleSocialSignInCall
        }) {

            it(description, async () => {
                const authorizationCodeMock = faker.datatype.uuid();
                const timezoneDummy = 'faketimezone';

                const userStub = getFindUserStub();
                const requestUserEmailMock = userStub?.email ?? null;
                const languageDummy = Language.KOREAN;

                _oauth2TokenServiceStub.getOAuth2UserProfile.resolves(googleOAuth2UserWithToken);
                _oauth2TokenServiceStub.getEmailFromOAuth2UserProfile.resolves(googleOAuth2UserWithToken.googleUser.email);

                evaluateIntegrationContextStub.resolves(integratinoContext);

                userServiceStub.findUserByEmail.resolves(userStub);

                const createdUserStub = stubOne(User);
                _oauth2TokenServiceStub.signUpWithOAuth.resolves(createdUserStub);

                const issuedTokenStub: CreateTokenResponseDto = {
                    accessToken: 'fakeJwtToken',
                    refreshToken: 'fakeRefreshToken'
                };
                issueTokenStub.returns(issuedTokenStub);

                const { issuedToken, isNewbie, insufficientPermission } = await service.issueTokenByOAuth2(
                    IntegrationVendor.GOOGLE,
                    authorizationCodeMock,
                    timezoneDummy,
                    integratinoContext,
                    requestUserEmailMock,
                    languageDummy
                );

                expect(issuedToken).ok;
                expect(isNewbie).equals(isExpectedNewbie);
                expect(insufficientPermission).equals(googleOAuth2UserWithToken.insufficientPermission);

                expect(oauth2TokenServiceLocatorStub.get.called).true;
                expect(_oauth2TokenServiceStub.getOAuth2UserProfile.called).true;
                expect(_oauth2TokenServiceStub.getEmailFromOAuth2UserProfile.called).true;

                expect(userServiceStub.findUserByEmail.called).true;

                expect(_oauth2TokenServiceStub.signUpWithOAuth.called).equals(signUpWithOAuthCall);
                expect(_oauth2TokenServiceStub.integrate.called).equals(integrateCall);
                expect(_oauth2TokenServiceStub.multipleSocialSignIn.called).equals(multipleSocialSignInCall);

                expect(issueTokenStub.called).true;
            });
        });
    });

    describe('Test evaluateIntegrationContext', () => {
        let serviceSandbox: sinon.SinonSandbox;

        let userStub: User;
        let _oauth2TokenServiceStub: sinon.SinonStubbedInstance<GoogleOAuth2TokenService>;


        beforeEach(() => {

            serviceSandbox = sinon.createSandbox();

            _oauth2TokenServiceStub = serviceSandbox.createStubInstance(GoogleOAuth2TokenService);
            oauth2TokenServiceLocatorStub.get.returns(_oauth2TokenServiceStub);

            const oauth2AccountStubs = stub(OAuth2Account);
            const googleIntegrationStubs = stub(GoogleIntegration);

            userStub = stubOne(User, {
                oauth2Accounts: oauth2AccountStubs,
                googleIntergrations: googleIntegrationStubs
            });

            userServiceStub.findUserByEmail.resolves(userStub);

            utilServiceStub.ensureIntegrationContext.returns(IntegrationContext.SIGN_UP);
        });

        afterEach(() => {
            userServiceStub.findUserByEmail.reset();

            utilServiceStub.ensureIntegrationContext.reset();

            _oauth2TokenServiceStub.getEmailFromOAuth2UserProfile.reset();

            oauth2TokenServiceLocatorStub.get.reset();

            serviceSandbox.restore();
        });

        it('should be converted to oauth2 user profile from authorization code', async () => {

            const oauth2UserProfileMock = testMockUtil.getGoogleOAuth2UserWithToken();
            const emailMock = stubOne(User).email;

            const googleOAuth2UserWithToken =  await service.evaluateIntegrationContext(
                IntegrationVendor.GOOGLE,
                oauth2UserProfileMock,
                IntegrationContext.SIGN_IN,
                emailMock
            );

            expect(_oauth2TokenServiceStub.getEmailFromOAuth2UserProfile.called).true;
            expect(userServiceStub.findUserByEmail.called).true;
            expect(utilServiceStub.ensureIntegrationContext.called).true;

            expect(googleOAuth2UserWithToken).ok;
        });
    });
});
