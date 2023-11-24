import { Test, TestingModule } from '@nestjs/testing';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { UtilService } from '@services/util/util.service';
import { UserService } from '@services/users/user.service';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { IntegrationsValidator } from '@services/integrations/integrations.validator';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { User } from '@entity/users/user.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { Language } from '@app/enums/language.enum';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleOAuth2TokenService } from './google-oauth2-token.service';

const testMockUtil = new TestMockUtil();

describe('GoogleOAuth2TokenService', () => {
    let service: GoogleOAuth2TokenService;

    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let oauth2AccountsServiceStub: sinon.SinonStubbedInstance<OAuth2AccountsService>;
    let integrationsServiceLocatorStub: sinon.SinonStubbedInstance<IntegrationsServiceLocator>;
    let integrationsValidatorStub: sinon.SinonStubbedInstance<IntegrationsValidator>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let googleIntegrationFacadeStub: sinon.SinonStubbedInstance<GoogleIntegrationFacade>;
    let googleConverterServiceStub: sinon.SinonStubbedInstance<GoogleConverterService>;
    let googleIntegrationServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationsService>;
    let notificationsServiceStub: sinon.SinonStubbedInstance<NotificationsService>;

    before(async () => {

        utilServiceStub = sinon.createStubInstance(UtilService);
        oauth2AccountsServiceStub = sinon.createStubInstance(OAuth2AccountsService);
        integrationsServiceLocatorStub = sinon.createStubInstance(IntegrationsServiceLocator);
        integrationsValidatorStub = sinon.createStubInstance(IntegrationsValidator);
        userServiceStub = sinon.createStubInstance(UserService);
        googleIntegrationFacadeStub = sinon.createStubInstance(GoogleIntegrationFacade);
        googleConverterServiceStub = sinon.createStubInstance(GoogleConverterService);
        googleIntegrationServiceStub = sinon.createStubInstance(GoogleIntegrationsService);
        notificationsServiceStub = sinon.createStubInstance(NotificationsService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleOAuth2TokenService,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: OAuth2AccountsService,
                    useValue: oauth2AccountsServiceStub
                },
                {
                    provide: IntegrationsServiceLocator,
                    useValue: integrationsServiceLocatorStub
                },
                {
                    provide: IntegrationsValidator,
                    useValue: integrationsValidatorStub
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
                },
                {
                    provide: GoogleIntegrationsService,
                    useValue: googleIntegrationServiceStub
                },
                {
                    provide: NotificationsService,
                    useValue: notificationsServiceStub
                }

            ]
        }).compile();

        service = module.get<GoogleOAuth2TokenService>(GoogleOAuth2TokenService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test getOAuth2UserProfile', () => {

        beforeEach(() => {

            const googleOAuth2UserWithTokenStub = testMockUtil.getGoogleOAuth2UserWithToken();

            googleIntegrationFacadeStub.fetchGoogleUsersWithToken.resolves(googleOAuth2UserWithTokenStub);
        });

        afterEach(() => {
            googleIntegrationFacadeStub.fetchGoogleUsersWithToken.reset();
        });

        it('should be converted to oauth2 user profile from authorization code', async () => {

            const authCodeMock = 'thisisAuuuuuthCode';

            const googleOAuth2UserWithToken =  await service.getOAuth2UserProfile(authCodeMock);

            expect(googleOAuth2UserWithToken).ok;
            expect(googleOAuth2UserWithToken.googleUser).ok;
            expect(googleIntegrationFacadeStub.fetchGoogleUsersWithToken.called).true;
        });
    });

    describe('Test signUpWithOAuth', () => {
        const oauth2UserProfileMock = testMockUtil.getGoogleOAuth2UserWithToken();

        let signedUpUserStub: User;

        beforeEach(() => {

            const userSettingStub = stubOne(UserSetting);
            signedUpUserStub = stubOne(User, {
                userSetting: userSettingStub
            });

            const googleCalendarIntegrationStubs = stub(GoogleCalendarIntegration);

            googleConverterServiceStub.convertToGoogleCalendarIntegration.returns(googleCalendarIntegrationStubs);

            userServiceStub.createUserByOAuth2.resolves(signedUpUserStub);
        });

        afterEach(() => {

            googleConverterServiceStub.convertToGoogleCalendarIntegration.reset();
            userServiceStub.createUserByOAuth2.reset();
            notificationsServiceStub.sendWelcomeEmailForNewUser.reset();
        });

        it('should be signed up with oauth2 for google', async () => {

            const timezoneMock = 'Asia/Seoul';
            const languageMock = Language.KOREAN;

            const signedUpUser = await service.signUpWithOAuth(
                timezoneMock,
                oauth2UserProfileMock,
                languageMock
            );

            expect(signedUpUser).ok;

            expect(googleConverterServiceStub.convertToGoogleCalendarIntegration.called).true;
            expect(userServiceStub.createUserByOAuth2.called).true;
            expect(notificationsServiceStub.sendWelcomeEmailForNewUser.called).true;
        });
    });

    describe('Test multiple social sign in', () => {

        afterEach(() => {
            oauth2AccountsServiceStub.create.reset();
        });

        it('should be created oauth2 account for supporting multiple social sign in', async () => {

            const userMock = stubOne(User);

            await service.multipleSocialSignIn(userMock, userMock.email);

            expect(oauth2AccountsServiceStub.create.called).true;
        });
    });

    describe('Test integration support', () => {

        beforeEach(() => {
            integrationsValidatorStub.hasOutboundCalendar.resolves(true);
        });

        afterEach(() => {
            integrationsValidatorStub.validateMaxAddLimit.reset();
            integrationsValidatorStub.hasOutboundCalendar.reset();
            googleIntegrationServiceStub.create.reset();
        });

        it('should be created oauth2 account for supporting multiple social sign in', async () => {

            const oauth2UserProfileMock = testMockUtil.getGoogleOAuth2UserWithToken();
            const userMock = stubOne(User);

            await service.integrate(
                oauth2UserProfileMock,
                userMock
            );

            expect(integrationsValidatorStub.validateMaxAddLimit.called).true;
            expect(integrationsValidatorStub.hasOutboundCalendar.called).true;
            expect(googleIntegrationServiceStub.create.called).true;
        });
    });

    describe('Test getEmailFromOAuth2UserProfile', () => {
        it('should be converted to email string from oauth 2 profile', () => {

            const oauth2UserProfileMock = testMockUtil.getGoogleOAuth2UserWithToken();

            const convertedEmail = service.getEmailFromOAuth2UserProfile(oauth2UserProfileMock);

            expect(convertedEmail).eq(oauth2UserProfileMock.googleUser.email);
        });
    });
});
