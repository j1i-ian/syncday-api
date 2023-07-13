import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageAttributeValue, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { EmailTemplate } from '@core/interfaces/integrations/email-template.enum';
import { SyncdayEmailAwsSnsRequest } from '@core/interfaces/integrations/syncday-email-aws-sns-request.interface';
import { SyncdayTwilioSmsAwsSnsRequest } from '@core/interfaces/integrations/syncday-twilio-sms-aws-sns-request.interface';
import { TwilioContentTemplate } from '@core/interfaces/integrations/twilio-content-template.enum';
import { SyncdayAwsSdkSnsNotificationService } from '@core/interfaces/integrations/syncday-aws-sdk-sns-notification-service.enum';
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
        syncdayAwsSdkSnsNotificationService: SyncdayAwsSdkSnsNotificationService,
        templateType: EmailTemplate | TwilioContentTemplate,
        receiver: string,
        language: Language,
        data: string
    ): Promise<boolean> {
        const notificationService: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify([syncdayAwsSdkSnsNotificationService])
        };

        let body: SyncdayEmailAwsSnsRequest | SyncdayTwilioSmsAwsSnsRequest;
        if (syncdayAwsSdkSnsNotificationService === SyncdayAwsSdkSnsNotificationService.EMAIL) {
            body = {
                recipient: receiver,
                emailTemplate: templateType as EmailTemplate,
                language,
                data
            } as SyncdayEmailAwsSnsRequest;
        } else {
            body = {
                phoneNumber: receiver,
                templateName: templateType as TwilioContentTemplate,
                language,
                data
            } as SyncdayTwilioSmsAwsSnsRequest;
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
