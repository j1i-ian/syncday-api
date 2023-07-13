import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';
import { UtilService } from '../util.service';
import { FileUtilsService } from './file-utils.service';

describe('FileUtilsService', () => {
    let service: FileUtilsService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let syncdayAwsSdkClientServiceStub: sinon.SinonStubbedInstance<SyncdayAwsSdkClientService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        utilServiceStub = sinon.createStubInstance(UtilService);
        syncdayAwsSdkClientServiceStub = sinon.createStubInstance(SyncdayAwsSdkClientService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FileUtilsService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: SyncdayAwsSdkClientService,
                    useValue: syncdayAwsSdkClientServiceStub
                }
            ]
        }).compile();

        service = module.get<FileUtilsService>(FileUtilsService);
    });

    after(() => {
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it.skip('should be get presignedurl', async () => {
    });
});
