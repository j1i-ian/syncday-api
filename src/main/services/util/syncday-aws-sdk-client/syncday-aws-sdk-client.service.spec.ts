import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SNSClient } from '@aws-sdk/client-sns';
import { S3Client } from '@aws-sdk/client-s3';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';

describe('SyncdayAwsSdkClientService', () => {
    let service: SyncdayAwsSdkClientService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let awsS3ClientStub : sinon.SinonStubbedInstance<S3Client>;
    let awsSnsClientStub : sinon.SinonStubbedInstance<SNSClient>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SyncdayAwsSdkClientService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: 'AWS_SERVICE_UNDEFINED',
                    useValue: awsSnsClientStub
                },
                {
                    provide: 'AWS_SERVICE_UNDEFINED',
                    useValue: awsS3ClientStub
                }
            ]
        }).compile();

        service = module.get<SyncdayAwsSdkClientService>(SyncdayAwsSdkClientService);
    });

    after(() => {
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test get aws sdk client service.', () => {
        before(() => {
            service.onModuleInit();
        });
        it('should be get aws sdk s3 client service', () => {
            const result = service.getS3Client();

            expect(result.config.serviceId).equals('S3');
        });

        it('should be get aws sdk sns client service', () => {
            const result = service.getSNSClient();

            expect(result.config.serviceId).equals('SNS');
        });
    });
});
