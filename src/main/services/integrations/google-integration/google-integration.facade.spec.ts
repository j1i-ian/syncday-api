import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from '@nestjs/common';
import { Auth, calendar_v3 } from 'googleapis';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { OAuth2Setting } from '@core/interfaces/auth/oauth2-setting.interface';
import { GoogleCredentials } from '@core/interfaces/integrations/google/google-credential.interface';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { GoogleOAuthClientService } from '@services/integrations/google-integration/facades/google-oauth-client.service';
import { GoogleOAuthTokenService } from '@services/integrations/google-integration/facades/google-oauth-token.service';
import { GoogleOAuthUserService } from '@services/integrations/google-integration/facades/google-oauth-user.service';
import { GoogleCalendarListService } from '@services/integrations/google-integration/facades/google-calendar-list.service';
import { GoogleCalendarEventListService } from '@services/integrations/google-integration/facades/google-calendar-event-list.service';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleIntegrationFacade } from './google-integration.facade';

describe('GoogleIntegrationFacade', () => {
    let service: GoogleIntegrationFacade;
    let serviceSandbox: sinon.SinonSandbox;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let loggerStub: sinon.SinonStubbedInstance<Logger>;

    let generateGoogleOAuthClientStub: sinon.SinonStub;
    let issueOAuthTokenByAuthorizationCodeStub: sinon.SinonStub;
    let getGoogleUserInfoStub: sinon.SinonStub;
    let googleCalendarListServiceSearchStub: sinon.SinonStub;
    let googleCalendarEventListServiceSearchStub: sinon.SinonStub;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        loggerStub = sinon.createStubInstance(Logger);

        sinon.stub(AppConfigService, 'getOAuth2Setting').returns({
            redirectURI: 'fakeSignInOrUpRedirectURI'
        } as OAuth2Setting);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleIntegrationFacade,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                }
            ]
        }).compile();

        service = module.get<GoogleIntegrationFacade>(GoogleIntegrationFacade);
    });

    after(() => {
        sinon.restore();
    });

    beforeEach(() => {
        serviceSandbox = sinon.createSandbox();

        generateGoogleOAuthClientStub = serviceSandbox.stub(
            GoogleOAuthClientService.prototype,
            'generateGoogleOAuthClient'
        );
        issueOAuthTokenByAuthorizationCodeStub = serviceSandbox.stub(
            GoogleOAuthTokenService.prototype,
            'issueOAuthTokenByAuthorizationCode'
        );
        getGoogleUserInfoStub = serviceSandbox.stub(
            GoogleOAuthUserService.prototype,
            'getGoogleUserInfo'
        );
        getGoogleUserInfoStub.resolves({
            email: 'fakeGoogleUserEmail@gmail.com'
        });
        googleCalendarListServiceSearchStub = serviceSandbox.stub(
            GoogleCalendarListService.prototype,
            'search'
        );

        googleCalendarListServiceSearchStub.resolves({
            items: [
                {
                    id: 'calendarMockId'
                } as calendar_v3.Schema$CalendarListEntry
            ]
        });

        googleCalendarEventListServiceSearchStub = serviceSandbox.stub(
            GoogleCalendarEventListService.prototype,
            'search'
        );

        googleCalendarEventListServiceSearchStub.resolves({
            items: []
        });

        serviceSandbox.stub(AppConfigService, 'getGoogleCredentials').returns({
            clientId: 'fakeClientId',
            clientSecret: 'fakeClientSecret'
        } as GoogleCredentials);
    });

    afterEach(() => {
        generateGoogleOAuthClientStub.reset();
        issueOAuthTokenByAuthorizationCodeStub.reset();
        getGoogleUserInfoStub.reset();
        googleCalendarListServiceSearchStub.reset();
        googleCalendarEventListServiceSearchStub.reset();

        serviceSandbox.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be fetched google users with token', async () => {
        const authorizationCodeMock = 'thisisfakeauthorizationcode';

        const oauth2ClientStub = serviceSandbox.createStubInstance(Auth.OAuth2Client);
        generateGoogleOAuthClientStub.returns(oauth2ClientStub);

        const oauthTokenStub = {
            accessToken: 'accessToken',
            refreshToken: 'refreshToken'
        } as OAuthToken;

        issueOAuthTokenByAuthorizationCodeStub.returns(oauthTokenStub);

        const result = await service.fetchGoogleUsersWithToken(authorizationCodeMock);

        expect(result).ok;
        expect(generateGoogleOAuthClientStub.called).true;
        expect(issueOAuthTokenByAuthorizationCodeStub.called).true;
        expect(oauth2ClientStub.setCredentials.called).true;
        expect(getGoogleUserInfoStub.called).true;
        expect(googleCalendarListServiceSearchStub.called).true;
        expect(googleCalendarEventListServiceSearchStub.called).true;
    });

    it('should be generated google oauth Authorization url', () => {
        const authorizationUrlStub = TestMockUtil.faker.internet.url();
        const profileMock = stubOne(Profile);
        const userMock = stubOne(User);

        const appJwtPayloadMock = {
            ...userMock,
            ...profileMock
        } as unknown as AppJwtPayload;

        const timezoneDummy = 'fakeTimezone';

        const oauth2ClientStub = serviceSandbox.createStubInstance(Auth.OAuth2Client);
        generateGoogleOAuthClientStub.returns(oauth2ClientStub);

        oauth2ClientStub.generateAuthUrl.returns(authorizationUrlStub);

        const authorizationUrl = service.generateGoogleOAuthAuthoizationUrl(
            IntegrationContext.SIGN_IN,
            appJwtPayloadMock,
            timezoneDummy
        );

        expect(authorizationUrl).ok;
        expect(oauth2ClientStub.generateAuthUrl.called).true;
    });
});
