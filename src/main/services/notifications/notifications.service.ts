import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageAttributeValue, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { SyncdayAwsSnsRequest } from '@core/interfaces/notifications/syncday-aws-sns-request.interface';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { AppConfigService } from '@config/app-config.service';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';
import { UtilService } from '@services/util/util.service';
import { ScheduledEventNotification } from '@entity/schedules/scheduled-event-notification.entity';
import { Language } from '@app/enums/language.enum';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly utilService: UtilService,
        private readonly configService: ConfigService,
        private readonly syncdayAwsSdkClientService: SyncdayAwsSdkClientService
    ) {}

    async sendMessages(
        scheduledEventNotifications: ScheduledEventNotification[]
    ): Promise<boolean> {

        const notificationDataAndPublishKeyMap = new Map();
        const notificationDataAndPublishKeyArray = scheduledEventNotifications
            .filter((_scheduleNotification) => {
                const {
                    notificationTarget
                } = _scheduleNotification;

                const isNotDuplicated = notificationDataAndPublishKeyMap.has(notificationTarget) === false;

                if (isNotDuplicated) {
                    notificationDataAndPublishKeyMap.set(notificationTarget, _scheduleNotification);
                }

                return isNotDuplicated;
            })
            .map((_scheduleNotification) => this.utilService.convertScheduleNotificationToNotificationDataAndPublishKey(_scheduleNotification));

        await Promise.all(
            notificationDataAndPublishKeyArray.map(
                ({
                    syncdayNotificationPublishKey,
                    notificationData
                }) => this.sendMessage(syncdayNotificationPublishKey, notificationData)
            )
        );

        return true;
    }

    async sendMessage(
        syncdayNotificationPublishKey: SyncdayNotificationPublishKey,
        notificationData: SyncdayAwsSnsRequest
    ): Promise<boolean> {
        const messageAttribute: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify([syncdayNotificationPublishKey])
        };

        return await this._sendNotification(messageAttribute, notificationData);
    }

    async sendWelcomeEmailForNewUser(userName: string, userEmail: string, preferredLanguage: Language): Promise<boolean> {
        const messageAttribute: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify([SyncdayNotificationPublishKey.EMAIL])
        };

        const notificationData = {
            template: EmailTemplate.WELCOME,
            recipient: userEmail,
            language: preferredLanguage,
            data: JSON.stringify({ userName })
        } as SyncdayAwsSnsRequest;

        return await this._sendNotification(messageAttribute, notificationData);
    }

    async _sendNotification(messageAttribute: MessageAttributeValue, notificationData: SyncdayAwsSnsRequest): Promise<boolean> {
        const params: PublishCommandInput = {
            Message: JSON.stringify(notificationData),
            TopicArn: AppConfigService.getAwsSnsTopicARNSyncdayNotification(this.configService),
            MessageAttributes: {
                notificationService: messageAttribute
            }
        };

        const response = await this.syncdayAwsSdkClientService.getSNSClient().send(new PublishCommand(params));

        const isSuccess = response.$metadata.httpStatusCode === 200;

        return isSuccess;
    }
}
