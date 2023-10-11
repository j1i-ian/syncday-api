import { Test, TestingModule } from '@nestjs/testing';
import * as tsdavModule from 'tsdav';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';
import { TestMockUtil } from '@test/test-mock-util';
import { AppleCaldavClientService } from './apple-caldav-client.service';

const testMockUtil = new TestMockUtil();

describe('AppleCaldavClientService', () => {
    let service: AppleCaldavClientService;

    let tsdavModuleStub: sinon.SinonStub;
    let tsdavModuleDAVClientLoginStub: sinon.SinonStub;

    before(async () => {

        tsdavModuleStub = sinon.stub(tsdavModule, 'default');
        tsdavModuleDAVClientLoginStub = sinon.stub();

        sinon.stub(tsdavModule, 'DAVClient').returns({
            login: tsdavModuleDAVClientLoginStub
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [AppleCaldavClientService]
        }).compile();

        service = module.get<AppleCaldavClientService>(AppleCaldavClientService);
    });

    afterEach(() => {
        tsdavModuleDAVClientLoginStub.reset();
    });

    after(() => {
        tsdavModuleStub.reset();
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be generated a DAVClient', async () => {

        const appleCalDAVCredential: AppleCalDAVCredential = testMockUtil.getAppleCalDAVCredentialMock();

        const generatedCalDAVClient = await service.generateCalDAVClient(appleCalDAVCredential);

        expect(generatedCalDAVClient).ok;

        expect(tsdavModuleDAVClientLoginStub.called).true;
    });
});
