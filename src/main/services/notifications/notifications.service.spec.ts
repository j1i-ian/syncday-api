import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SNSClient } from '@aws-sdk/client-sns';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { SyncdayAwsSnsRequest } from '@core/interfaces/notifications/syncday-aws-sns-request.interface';
import { AppConfigService } from '@config/app-config.service';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { ReminderType } from '@interfaces/reminders/reminder-type.enum';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';
import { FileUtilsService } from '@services/util/file-utils/file-utils.service';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { ScheduledEventNotification } from '@entity/schedules/scheduled-event-notification.entity';
import { NotificationTarget } from '@entity/schedules/notification-target.enum';
import { Event } from '@entity/events/event.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Team } from '@entity/teams/team.entity';
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

    let teamSettingServiceStub: sinon.SinonStubbedInstance<TeamSettingService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        awsSnsClientStub = sinon.createStubInstance(SNSClient);
        fileUtilsServiceStub = sinon.createStubInstance(FileUtilsService);
        syncdayAwsSdkClientServiceStub = sinon.createStubInstance(SyncdayAwsSdkClientService);
        utilServiceStub = sinon.createStubInstance(UtilService);

        teamSettingServiceStub = sinon.createStubInstance(TeamSettingService);
        eventsServiceStub = sinon.createStubInstance(EventsService);

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
                },
                {
                    provide: EventsService,
                    useValue: eventsServiceStub
                },
                {
                    provide: TeamSettingService,
                    useValue: teamSettingServiceStub
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

    describe('Test Booking Request Test', () => {

        let eventTypeStub: Event;
        let serviceSandbox: sinon.SinonSandbox;
        let serviceSendMessageStub: sinon.SinonStub<[syncdayNotificationPublishKey: SyncdayNotificationPublishKey, notificationData: SyncdayAwsSnsRequest]>;

        beforeEach(() => {
            eventTypeStub = stubOne(Event);
            utilServiceStub.convertReminderTypeToSyncdayNotificationPublishKey.returns(SyncdayNotificationPublishKey.KAKAOTALK);

            eventsServiceStub.findOne.resolves(eventTypeStub);

            const teamSettingStub = stubOne(TeamSetting);
            teamSettingServiceStub.fetchTeamSettingByTeamId.resolves(teamSettingStub);

            serviceSandbox = sinon.createSandbox();
            serviceSendMessageStub = serviceSandbox.stub(service, 'sendMessage');
            serviceSendMessageStub.resolves(true);
        });

        afterEach(() => {
            utilServiceStub.convertReminderTypeToSyncdayNotificationPublishKey.reset();
            eventsServiceStub.findOne.reset();
            teamSettingServiceStub.fetchTeamSettingByTeamId.reset();

            serviceSandbox.restore();
        });

        it('should be sent booking request', async () => {

            const teamMock = stubOne(Team);

            const invitee = {
                name: '홍길동',
                phoneNumber: '+821012341234'
            };

            const bookingRequestResult = await firstValueFrom(service.sendBookingRequest(
                teamMock.id,
                eventTypeStub.id,
                teamMock.name,
                invitee.name,
                invitee.phoneNumber,
                'memo'
            ));

            expect(utilServiceStub.convertReminderTypeToSyncdayNotificationPublishKey.called).true;
            expect(eventsServiceStub.findOne.called).true;
            expect(teamSettingServiceStub.fetchTeamSettingByTeamId.called).true;

            expect(serviceSendMessageStub.called).true;

            expect(bookingRequestResult).true;
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

    describe('Test sending cancellation messages', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            utilServiceStub.convertScheduleNotificationToNotificationDataAndPublishKey.reset();

            serviceSandbox.restore();
        });

        [
            {
                description: 'When there are two emails in the ScheduledEventNotifications, one cancellation notifications should be sent after email deduplication',
                scheduledEventNotificationsMock: [
                    stubOne(ScheduledEventNotification, {
                        notificationTarget: NotificationTarget.HOST,
                        notificationType: NotificationType.EMAIL
                    }),
                    stubOne(ScheduledEventNotification, {
                        notificationTarget: NotificationTarget.INVITEE,
                        notificationType: NotificationType.EMAIL
                    })
                ],
                expectedSendMessageCallCount: 1
            },
            {
                description: 'When there are two emails and one text in the ScheduledEventNotifications, two cancellation notifications should be sent after email deduplication',
                scheduledEventNotificationsMock: [
                    stubOne(ScheduledEventNotification, {
                        notificationTarget: NotificationTarget.HOST,
                        notificationType: NotificationType.EMAIL
                    }),
                    stubOne(ScheduledEventNotification, {
                        notificationTarget: NotificationTarget.INVITEE,
                        notificationType: NotificationType.EMAIL
                    }),
                    stubOne(ScheduledEventNotification, {
                        notificationTarget: NotificationTarget.HOST,
                        notificationType: NotificationType.TEXT,
                        reminderType: ReminderType.KAKAOTALK
                    })
                ],
                expectedSendMessageCallCount: 2
            },
            {
                description: 'When there are two emails and two texts in the ScheduledEventNotifications, three cancellation notifications should be sent after email deduplication',
                scheduledEventNotificationsMock: [
                    stubOne(ScheduledEventNotification, {
                        notificationTarget: NotificationTarget.HOST,
                        notificationType: NotificationType.EMAIL
                    }),
                    stubOne(ScheduledEventNotification, {
                        notificationTarget: NotificationTarget.INVITEE,
                        notificationType: NotificationType.EMAIL
                    }),
                    stubOne(ScheduledEventNotification, {
                        notificationTarget: NotificationTarget.HOST,
                        notificationType: NotificationType.TEXT,
                        reminderType: ReminderType.KAKAOTALK
                    }),
                    stubOne(ScheduledEventNotification, {
                        notificationTarget: NotificationTarget.INVITEE,
                        notificationType: NotificationType.TEXT,
                        reminderType: ReminderType.KAKAOTALK
                    })
                ],
                expectedSendMessageCallCount: 3
            }
        ].forEach(function ({
            description,
            scheduledEventNotificationsMock,
            expectedSendMessageCallCount
        }) {
            it(description, async () => {
                const sendMessageStub = serviceSandbox.stub(service, 'sendMessage');
                sendMessageStub.resolves(true);

                const convertScheduleNotificationToNotificationDataAndPublishKeyStub = {
                    notificationData: {
                        template: EmailTemplate.CANCELLED,
                        scheduleId: 1
                    } as SyncdayAwsSnsRequest,
                    syncdayNotificationPublishKey: SyncdayNotificationPublishKey.EMAIL
                };
                utilServiceStub.convertScheduleNotificationToNotificationDataAndPublishKey.returns(
                    convertScheduleNotificationToNotificationDataAndPublishKeyStub
                );

                await service.sendCancellationMessages(scheduledEventNotificationsMock);

                expect(utilServiceStub.convertScheduleNotificationToNotificationDataAndPublishKey.callCount).equals(expectedSendMessageCallCount);
                expect(sendMessageStub.callCount).equal(expectedSendMessageCallCount);
            });
        });
    });
});
