import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageAttributeValue, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { EmailTemplate } from '@core/interfaces/integrations/email-template.enum';
import { SyncdayEmailAwsSnsRequest } from '@core/interfaces/integrations/syncday-email-aws-sns-request.interface';
import { TextTemplate } from '@core/interfaces/integrations/text-template.enum';
import { SyncdayTextAwsSnsRequest } from '@core/interfaces/integrations/syncday-text-aws-sns-request.interface';
import { SyncdayNotificationPublishKey } from '@core/interfaces/integrations/syncday-notification-publish-key.enum';
import { AppConfigService } from '@config/app-config.service';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';
import { Language } from '@app/enums/language.enum';

@Injectable()
export class IntegrationsService {
    constructor(
        private readonly configService: ConfigService,
        private readonly syncdayAwsSdkClientService: SyncdayAwsSdkClientService
    ) {}

    async sendMessage(
        syncdayNotificationPublishKey: SyncdayNotificationPublishKey,
        templateType: EmailTemplate | TextTemplate,
        recipient: string,
        language: Language,
        data: string
    ): Promise<boolean> {
        const notificationService: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify([syncdayNotificationPublishKey])
        };

        let body: SyncdayEmailAwsSnsRequest | SyncdayTextAwsSnsRequest;
        if (syncdayNotificationPublishKey === SyncdayNotificationPublishKey.EMAIL) {
            body = {
                recipient,
                emailTemplate: templateType as EmailTemplate,
                language,
                data
            } as SyncdayEmailAwsSnsRequest;
        } else {
            body = {
                recipient,
                templateName: templateType as TextTemplate,
                language,
                data
            } as SyncdayTextAwsSnsRequest;
        }

        const params: PublishCommandInput = {
            Message: JSON.stringify(body),
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
