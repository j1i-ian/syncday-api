import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { calendar_v3 } from 'googleapis';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom, of } from 'rxjs';
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
import { ProfilesService } from '@services/profiles/profiles.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { User } from '@entity/users/user.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
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
    let profileServiceStub: sinon.SinonStubbedInstance<ProfilesService>;
    let oauth2TokenServiceLocatorStub: sinon.SinonStubbedInstance<OAuth2TokenServiceLocator>;

    let oauth2TokenServiceStub: sinon.SinonStubbedInstance<GoogleOAuth2TokenService>;
    let notificationsServiceStub: sinon.SinonStubbedInstance<NotificationsService>;

    let loggerStub: sinon.SinonStub;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        jwtServiceStub = sinon.createStubInstance(JwtService);
        utilServiceStub = sinon.createStubInstance(UtilService);
        userServiceStub = sinon.createStubInstance(UserService);
        profileServiceStub = sinon.createStubInstance(ProfilesService);
        oauth2TokenServiceLocatorStub = sinon.createStubInstance(OAuth2TokenServiceLocator);

        oauth2TokenServiceStub = sinon.createStubInstance(GoogleOAuth2TokenService);
        notificationsServiceStub = sinon.createStubInstance(NotificationsService);

        oauth2TokenServiceLocatorStub.get.returns(oauth2TokenServiceStub);

        loggerStub = sinon.stub({
            debug: () => {},
            info: () => {},
            error: () => {}
        } as unknown as Logger) as unknown as sinon.SinonStub;

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
                    provide: ProfilesService,
                    useValue: profileServiceStub
                },
                {
                    provide: OAuth2TokenServiceLocator,
                    useValue: oauth2TokenServiceLocatorStub
                },
                {
                    provide: NotificationsService,
                    useValue: notificationsServiceStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
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
        const profileMock = stubOne(Profile);
        const teamMock = stubOne(Team);
        const userSettingIdMock = stubOne(UserSetting).id;
        const fakeTokenStub = 'iamfaketoken';

        jwtServiceStub.sign.returns(fakeTokenStub);

        const signed = service.issueToken(
            profileMock,
            userMock,
            teamMock,
            userSettingIdMock
        );

        expect(signed).ok;
        expect(signed.accessToken).equal(fakeTokenStub);
        expect(jwtServiceStub.sign.called).true;
        expect(jwtServiceStub.sign.calledTwice).true;
        expect(service).ok;

        jwtServiceStub.sign.reset();
    });

    describe('Test issueTokenByRefreshToken', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        it('should be issued token by refresh token', async () => {
            const profileStub = stubOne(Profile);
            const fakeRefreshTokenMock = 'iamfakeRefreshToken';

            const issuedTokenStub: CreateTokenResponseDto = {
                accessToken: 'fakeJwtToken',
                refreshToken: 'fakeRefreshToken'
            };

            jwtServiceStub.verify.returns(profileStub);

            const issueTokenStub = serviceSandbox.stub(service, 'issueToken').returns(issuedTokenStub);

            const signed = await firstValueFrom(service.issueTokenByRefreshToken(fakeRefreshTokenMock));

            expect(issueTokenStub.called).true;
            expect(signed).ok;
            expect(signed.accessToken).equal(issuedTokenStub.accessToken);
            expect(signed.refreshToken).equal(issuedTokenStub.refreshToken);
            expect(profileServiceStub.findProfile.called).false;
        });

        it('should be issued token for team switching', async () => {
            const teamIdMock = stubOne(Team).id;
            const userIdMock = stubOne(User).id;
            const profileStub = stubOne(Profile, {
                userId: userIdMock
            });
            const fakeRefreshTokenMock = 'iamfakeRefreshToken';

            const issuedTokenStub: CreateTokenResponseDto = {
                accessToken: 'fakeJwtToken',
                refreshToken: 'fakeRefreshToken'
            };

            jwtServiceStub.verify.returns(profileStub);

            const issueTokenStub = serviceSandbox.stub(service, 'issueToken').returns(issuedTokenStub);

            profileServiceStub.findProfile.returns(of(profileStub));

            const signed = await firstValueFrom(
                service.issueTokenByRefreshToken(
                    fakeRefreshTokenMock,
                    teamIdMock,
                    userIdMock
                )
            );

            expect(issueTokenStub.called).true;
            expect(signed).ok;
            expect(signed.accessToken).equal(issuedTokenStub.accessToken);
            expect(signed.refreshToken).equal(issuedTokenStub.refreshToken);
            expect(profileServiceStub.findProfile.called).true;
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

            profileServiceStub.createInvitedProfiles.returns(of([]));
            profileServiceStub.completeInvitation.returns(of(true));

            evaluateIntegrationContextStub = serviceSandbox.stub(service, 'evaluateIntegrationContext');
            issueTokenStub = serviceSandbox.stub(service, 'issueToken');
        });

        afterEach(() => {

            oauth2TokenServiceLocatorStub.get.reset();

            _oauth2TokenServiceStub.getOAuth2UserProfile.reset();
            _oauth2TokenServiceStub.getEmailFromOAuth2UserProfile.reset();

            userServiceStub.findUserByEmail.reset();
            profileServiceStub.createInvitedProfiles.reset();
            profileServiceStub.completeInvitation.reset();

            userServiceStub.createUser.reset();
            notificationsServiceStub.sendWelcomeEmailForNewUser.reset();
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
                createUserCall: true,
                sendWelcomeEmailForNewUserCall: true,
                createInvitedProfilesCall: true,
                completeInvitationCall: true,
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
                    profiles: [
                        stubOne(Profile, {
                            googleIntergrations: [],
                            team: stubOne(Team)
                        })
                    ],
                    userSetting: stubOne(UserSetting)
                }),
                isExpectedNewbie: false,
                createUserCall: false,
                sendWelcomeEmailForNewUserCall: false,
                createInvitedProfilesCall: false,
                completeInvitationCall: false,
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
                    profiles: [
                        stubOne(Profile, {
                            googleIntergrations: [],
                            team: stubOne(Team)
                        })
                    ],
                    userSetting: stubOne(UserSetting)
                }),
                isExpectedNewbie: false,
                createUserCall: false,
                sendWelcomeEmailForNewUserCall: false,
                createInvitedProfilesCall: false,
                completeInvitationCall: false,
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
                    profiles: [
                        stubOne(Profile, {
                            googleIntergrations: [],
                            team: stubOne(Team)
                        })
                    ],
                    userSetting: stubOne(UserSetting)
                }),
                isExpectedNewbie: false,
                createUserCall: false,
                sendWelcomeEmailForNewUserCall: false,
                createInvitedProfilesCall: false,
                completeInvitationCall: false,
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
                    profiles: [
                        stubOne(Profile, {
                            googleIntergrations: [
                                {
                                    id: 1,
                                    email: 'fakeEmail'
                                }
                            ] as GoogleIntegration[],
                            team: stubOne(Team)
                        })
                    ],
                    userSetting: stubOne(UserSetting)
                }),
                isExpectedNewbie: false,
                createUserCall: false,
                sendWelcomeEmailForNewUserCall: false,
                createInvitedProfilesCall: false,
                completeInvitationCall: false,
                integrateCall: true,
                multipleSocialSignInCall: false
            }
        ].forEach(function({
            description,
            integratinoContext,
            googleOAuth2UserWithToken,
            getFindUserStub,
            isExpectedNewbie,
            createUserCall: createUserCall,
            sendWelcomeEmailForNewUserCall,
            createInvitedProfilesCall,
            completeInvitationCall,
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

                const createdTeamStub = stubOne(Team);
                const createdProfileStub = stubOne(Profile);
                const createdUserSettingStub = stubOne(UserSetting);
                const createdUserStub = stubOne(User, {
                    userSetting: createdUserSettingStub
                });
                userServiceStub.createUser.returns(of({
                    createdUser: createdUserStub,
                    createdProfile: createdProfileStub,
                    createdTeam: createdTeamStub
                }));

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

                expect(profileServiceStub.createInvitedProfiles.called).equals(createInvitedProfilesCall);
                expect(profileServiceStub.completeInvitation.called).equals(completeInvitationCall);

                expect(userServiceStub.createUser.called).equals(createUserCall);
                expect(notificationsServiceStub.sendWelcomeEmailForNewUser.called).equals(sendWelcomeEmailForNewUserCall);
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
            const profileStub = stubOne(Profile, {
                googleIntergrations: googleIntegrationStubs
            });

            userStub = stubOne(User, {
                oauth2Accounts: oauth2AccountStubs,
                profiles: [
                    profileStub
                ]
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
