import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SNSClient } from '@aws-sdk/client-sns';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { AppConfigService } from '@config/app-config.service';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';
import { FileUtilsService } from '@services/util/file-utils/file-utils.service';
import { Language } from '@app/enums/language.enum';
import { TestMockUtil } from '@test/test-mock-util';
import { faker } from '@faker-js/faker';
import { IntegrationsService } from './integrations.service';

const testMockUtil = new TestMockUtil();

describe('IntegrationsService', () => {
    let service: IntegrationsService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let awsSnsClientStub: sinon.SinonStubbedInstance<SNSClient>;
    let fileUtilsServiceStub: SinonStubbedInstance<FileUtilsService>;
    let syncdayAwsSdkClientServiceStub: sinon.SinonStubbedInstance<SyncdayAwsSdkClientService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        awsSnsClientStub = sinon.createStubInstance(SNSClient);
        fileUtilsServiceStub = sinon.createStubInstance(FileUtilsService);
        syncdayAwsSdkClientServiceStub = sinon.createStubInstance(SyncdayAwsSdkClientService);

        sinon.stub(AppConfigService, 'getAwsSnsTopicARNSyncdayNotification').returns(
            'fakeAwsSnsTopicARNSyncdayNotification'
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntegrationsService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: 'AWS_SERVICE_UNDEFINED',
                    useValue: awsSnsClientStub
                },
                {
                    provide: FileUtilsService,
                    useValue: fileUtilsServiceStub
                },
                {
                    provide: SyncdayAwsSdkClientService,
                    useValue: syncdayAwsSdkClientServiceStub
                }
            ]
        }).compile();

        service = module.get<IntegrationsService>(IntegrationsService);
    });

    after(() => {
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Verification email sent', () => {
        it('should be sent verification email', async () => {
            const recipientMock = faker.internet.email();
            const emailTemplateMock = EmailTemplate.VERIFICATION;
            const languageMock = Language.ENGLISH;
            const verificationMock = testMockUtil.getVerificationMock();

            const publishCommandOutputStub = {
                MessageId: 'a8b9c1d2-3e4f-5a6b-7c8d-9e0f1a2b3c4d',
                $metadata: {
                    httpStatusCode: 200
                }
            };

            syncdayAwsSdkClientServiceStub.getSNSClient.returns(awsSnsClientStub);
            awsSnsClientStub.send.resolves(publishCommandOutputStub);

            const result = await service.sendMessage(
                SyncdayNotificationPublishKey.EMAIL,
                emailTemplateMock,
                recipientMock,
                languageMock,
                JSON.stringify(verificationMock)
            );

            expect(awsSnsClientStub.send.called).ok;
            expect(result).true;
        });
    });
});
