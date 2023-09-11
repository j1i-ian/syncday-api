import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageAttributeValue, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { SyncdayAwsSnsRequest } from '@core/interfaces/notifications/syncday-aws-sns-request.interface';
import { AppConfigService } from '@config/app-config.service';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly configService: ConfigService,
        private readonly syncdayAwsSdkClientService: SyncdayAwsSdkClientService
    ) {}

    async sendMessage(
        syncdayNotificationPublishKey: SyncdayNotificationPublishKey,
        notificationData: SyncdayAwsSnsRequest
    ): Promise<boolean> {
        const notificationService: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify([syncdayNotificationPublishKey])
        };

        const params: PublishCommandInput = {
            Message: JSON.stringify(notificationData),
            TopicArn: AppConfigService.getAwsSnsTopicARNSyncdayNotification(this.configService),
            MessageAttributes: {
                notificationService
            }
        };

        const response = await this.syncdayAwsSdkClientService.getSNSClient().send(new PublishCommand(params));

        const isSuccess = response.$metadata.httpStatusCode === 200;

        return isSuccess;
    }
}
