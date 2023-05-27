import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from '@nestjs/common';
import { Auth } from 'googleapis';
import { AppConfigService } from '@config/app-config.service';
import { GoogleOAuthClientService } from '@services/integrations/google-integration/facades/google-oauth-client.service';
import { GoogleOAuthTokenService } from '@services/integrations/google-integration/facades/google-oauth-token.service';
import { GoogleOAuthUserService } from '@services/integrations/google-integration/facades/google-oauth-user.service';
import { GoogleCalendarListService } from '@services/integrations/google-integration/facades/google-calendar-list.service';
import { GoogleOAuth2Setting } from '@app/interfaces/auth/google-oauth2-setting.interface';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleIntegrationFacade } from './google-integration.facade';

describe('GoogleIntegrationFacade', () => {
    let service: GoogleIntegrationFacade;
    let serviceSandbox: sinon.SinonSandbox;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let loggerStub: sinon.SinonStubbedInstance<Logger>;

    let generateGoogleOAuthClientStub: sinon.SinonStub;
    let issueGoogleTokenByAuthorizationCodeStub: sinon.SinonStub;
    let getGoogleUserInfoStub: sinon.SinonStub;
    let googleCalendarListServiceSearchStub: sinon.SinonStub;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        loggerStub = sinon.createStubInstance(Logger);

        sinon.stub(AppConfigService, 'getGoogleOAuth2Setting').returns({
            redirectURI: 'fakeSignInOrUpRedirectURI'
        } as GoogleOAuth2Setting);

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
        issueGoogleTokenByAuthorizationCodeStub = serviceSandbox.stub(
            GoogleOAuthTokenService.prototype,
            'issueGoogleTokenByAuthorizationCode'
        );
        getGoogleUserInfoStub = serviceSandbox.stub(
            GoogleOAuthUserService.prototype,
            'getGoogleUserInfo'
        );
        googleCalendarListServiceSearchStub = serviceSandbox.stub(
            GoogleCalendarListService.prototype,
            'search'
        );

        serviceSandbox.stub(AppConfigService, 'getGoogleCredentials').returns({
            redirectURI: 'fakeSignInOrUpRedirectURI'
        } as GoogleOAuth2Setting);
    });

    afterEach(() => {
        generateGoogleOAuthClientStub.reset();
        issueGoogleTokenByAuthorizationCodeStub.reset();
        getGoogleUserInfoStub.reset();
        googleCalendarListServiceSearchStub.reset();

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

        issueGoogleTokenByAuthorizationCodeStub.returns(oauthTokenStub);

        const result = await service.fetchGoogleUsersWithToken(authorizationCodeMock);

        expect(result).ok;
        expect(generateGoogleOAuthClientStub.called).true;
        expect(issueGoogleTokenByAuthorizationCodeStub.called).true;
        expect(oauth2ClientStub.setCredentials.called).true;
        expect(getGoogleUserInfoStub.called).true;
        expect(googleCalendarListServiceSearchStub.called).true;
    });

    it('should be generated google oauth Authorization url', () => {
        const authorizationUrlStub = TestMockUtil.faker.internet.url();

        const oauth2ClientStub = serviceSandbox.createStubInstance(Auth.OAuth2Client);
        generateGoogleOAuthClientStub.returns(oauth2ClientStub);

        oauth2ClientStub.generateAuthUrl.returns(authorizationUrlStub);

        const authorizationUrl = service.generateGoogleOAuthAuthoizationUrl();

        expect(authorizationUrl).ok;
        expect(oauth2ClientStub.generateAuthUrl.called).true;
    });
});