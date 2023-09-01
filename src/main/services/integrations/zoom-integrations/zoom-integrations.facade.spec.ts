import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '@config/app-config.service';
import { ZoomOauthTokenService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-token.service';
import { ZoomIntegrationFacade } from '@services/integrations/zoom-integrations/zoom-integrations.facade';
import { ZoomOauthUserService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-user.service';
import { ZoomCreateMeetingService } from '@services/integrations/zoom-integrations/facades/zoom-create-meeting.service';
import { TestMockUtil } from '@test/test-mock-util';

const testMockUtil = new TestMockUtil();

describe('ZoomIntegrationFacade Spec', () => {
    let facade: ZoomIntegrationFacade;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let zoomOauthTokenServiceStub: sinon.SinonStubbedInstance<ZoomOauthTokenService>;
    let zoomOauthUserServiceStub: sinon.SinonStubbedInstance<ZoomOauthUserService>;
    let zoomCreateMeetingServiceStub: sinon.SinonStubbedInstance<ZoomCreateMeetingService>;

    before(async () => {

        sinon.stub(AppConfigService, 'getZoomRedirectUri').returns('fakeRedirectURI');

        configServiceStub = sinon.createStubInstance(ConfigService);
        zoomOauthTokenServiceStub = sinon.createStubInstance(ZoomOauthTokenService);
        zoomOauthUserServiceStub = sinon.createStubInstance(ZoomOauthUserService);
        zoomCreateMeetingServiceStub = sinon.createStubInstance(ZoomCreateMeetingService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ZoomIntegrationFacade,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: ZoomOauthTokenService,
                    useValue: zoomOauthTokenServiceStub
                },
                {
                    provide: ZoomOauthUserService,
                    useValue: zoomOauthUserServiceStub
                },
                {
                    provide: ZoomCreateMeetingService,
                    useValue: zoomCreateMeetingServiceStub
                }
            ]
        }).compile();

        facade = module.get<ZoomIntegrationFacade>(ZoomIntegrationFacade);
    });

    after(() => {
        sinon.restore();
    });

    afterEach(() => {
        zoomOauthTokenServiceStub.issueOAuthTokenByAuthorizationCode.reset();
    });

    it('should be defiend', () => {
        expect(facade).ok;
        expect(zoomOauthTokenServiceStub).ok;
    });

    it('should be issued token', async () => {

        const authorizationCodeMock = 'fakeAuthCode';

        const oauthTokenStub = testMockUtil.getOAuthTokenMock();
        zoomOauthTokenServiceStub.issueOAuthTokenByAuthorizationCode.resolves(oauthTokenStub);

        const issuedToken = await facade.issueToken(authorizationCodeMock);

        expect(zoomOauthTokenServiceStub.issueOAuthTokenByAuthorizationCode.called).true;
        expect(zoomOauthTokenServiceStub.issueOAuthTokenByAuthorizationCode.calledWith(authorizationCodeMock)).true;
        expect(issuedToken).ok;
        expect(issuedToken.accessToken).ok;
        expect(issuedToken.refreshToken).ok;
    });

});
