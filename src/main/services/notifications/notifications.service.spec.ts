import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SNSClient } from '@aws-sdk/client-sns';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { SyncdayAwsSnsRequest } from '@core/interfaces/notifications/syncday-aws-sns-request.interface';
import { AppConfigService } from '@config/app-config.service';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';
import { FileUtilsService } from '@services/util/file-utils/file-utils.service';
import { UtilService } from '@services/util/util.service';
import { Language } from '@app/enums/language.enum';
import { TestMockUtil } from '@test/test-mock-util';
import { faker } from '@faker-js/faker';
import { NotificationsService } from './notifications.service';

const testMockUtil = new TestMockUtil();

describe('IntegrationsService', () => {
    let service: NotificationsService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let awsSnsClientStub: sinon.SinonStubbedInstance<SNSClient>;
    let fileUtilsServiceStub: SinonStubbedInstance<FileUtilsService>;
    let syncdayAwsSdkClientServiceStub: sinon.SinonStubbedInstance<SyncdayAwsSdkClientService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        awsSnsClientStub = sinon.createStubInstance(SNSClient);
        fileUtilsServiceStub = sinon.createStubInstance(FileUtilsService);
        syncdayAwsSdkClientServiceStub = sinon.createStubInstance(SyncdayAwsSdkClientService);
        utilServiceStub = sinon.createStubInstance(UtilService);

        sinon.stub(AppConfigService, 'getAwsSnsTopicARNSyncdayNotification').returns(
            'fakeAwsSnsTopicARNSyncdayNotification'
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationsService,
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
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                }
            ]
        }).compile();

        service = module.get<NotificationsService>(NotificationsService);
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

            const notificationData = {
                recipient: recipientMock,
                template: emailTemplateMock,
                language: languageMock,
                data: JSON.stringify(verificationMock)
            } as SyncdayAwsSnsRequest;

            const result = await service.sendMessage(
                SyncdayNotificationPublishKey.EMAIL,
                notificationData
            );

            expect(awsSnsClientStub.send.called).ok;
            expect(result).true;
        });

        it('should be sent welcome email', async () => {
            const userNameMock = 'harry';
            const userEmailMock = faker.internet.email();
            const preferredLanguageMock = Language.ENGLISH;

            const publishCommandOutputStub = {
                MessageId: 'a8b9c1d2-3e4f-5a6b-7c8d-9e0f1a2b3c4d',
                $metadata: {
                    httpStatusCode: 200
                }
            };

            syncdayAwsSdkClientServiceStub.getSNSClient.returns(awsSnsClientStub);
            awsSnsClientStub.send.resolves(publishCommandOutputStub);

            const result = await service.sendWelcomeEmailForNewUser(userNameMock, userEmailMock, preferredLanguageMock);

            expect(awsSnsClientStub.send.called).ok;
            expect(result).true;
        });
    });
});
