import { Test, TestingModule } from '@nestjs/testing';
import * as nodeFetchModule from 'node-fetch';
import { ZoomTokenResponseDTO } from '@interfaces/integrations/zoom/zoom-token-response.interface';
import { TestMockUtil } from '@test/test-mock-util';
import { ZoomOauthTokenService } from './zoom-oauth-token.service';

const testMockUtil = new TestMockUtil();

describe('ZoomOauthTokenService', () => {
    let service: ZoomOauthTokenService;

    let nodeFetchModuleStub: sinon.SinonStub;

    let serviceSandbox: sinon.SinonSandbox;

    before(async () => {

        nodeFetchModuleStub = sinon.stub(nodeFetchModule, 'default');

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ZoomOauthTokenService
            ]
        }).compile();

        service = module.get<ZoomOauthTokenService>(ZoomOauthTokenService);
    });

    after(() => {
        nodeFetchModuleStub.reset();
        sinon.restore();
    });

    beforeEach(() => {
        serviceSandbox = sinon.createSandbox();
    });

    afterEach(() => {
        serviceSandbox.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be got oauth token with auth code', async () => {

        const oauthTokenStub = testMockUtil.getOAuthTokenMock();

        const headerStub = {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic abcde:fghij'
        };
        const zoomTokenResponseDTOStub: ZoomTokenResponseDTO = {
            access_token: oauthTokenStub.accessToken,
            refresh_token: oauthTokenStub.refreshToken
        } as ZoomTokenResponseDTO;
        const authorizationCode = 'fakeAuthorizationCode';

        const _getBasicAuthHeaderStub = serviceSandbox.stub(service, '_getBasicAuthHeader');
        _getBasicAuthHeaderStub.resolves(headerStub);
        nodeFetchModuleStub.resolves({
            json: () => Promise.resolve(zoomTokenResponseDTOStub)
        });

        const token = await service.issueOAuthTokenByAuthorizationCode(
            authorizationCode,
            'fakeClientId',
            'fakeClientSecret'
        );
        expect(token).ok;
        expect(token.accessToken).equals(oauthTokenStub.accessToken);
        expect(token.refreshToken).equals(oauthTokenStub.refreshToken);
        expect(_getBasicAuthHeaderStub.called).true;
        expect(nodeFetchModuleStub.called).true;
    });

    it('should be got oauth token with refresh token', async () => {

        const oauthTokenStub = testMockUtil.getOAuthTokenMock();

        const headerStub = {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic abcde:fghij'
        };
        const zoomTokenResponseDTOStub: ZoomTokenResponseDTO = {
            access_token: oauthTokenStub.accessToken,
            refresh_token: oauthTokenStub.refreshToken
        } as ZoomTokenResponseDTO;
        const authorizationCode = 'fakeAuthorizationCode';

        const _getBasicAuthHeaderStub = serviceSandbox.stub(service, '_getBasicAuthHeader');
        _getBasicAuthHeaderStub.resolves(headerStub);
        nodeFetchModuleStub.resolves({
            json: () => Promise.resolve(zoomTokenResponseDTOStub)
        });

        const token = await service.issueOAuthTokenByRefreshToken(
            authorizationCode,
            'fakeClientId'
        );
        expect(token).ok;
        expect(token.accessToken).equals(oauthTokenStub.accessToken);
        expect(token.refreshToken).equals(oauthTokenStub.refreshToken);
        expect(_getBasicAuthHeaderStub.called).true;
        expect(nodeFetchModuleStub.called).true;
    });
});
