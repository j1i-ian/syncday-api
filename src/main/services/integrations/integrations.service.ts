import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageAttributeValue, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { EmailTemplate } from '@core/interfaces/integrations/email-template.enum';
import { SyncdayEmailAwsSnsRequest } from '@core/interfaces/integrations/syncday-email-aws-sns-request.interface';
import { AppConfigService } from '@config/app-config.service';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';
import { Language } from '@app/enums/language.enum';

@Injectable()
export class IntegrationsService {
    constructor(
        private readonly configService: ConfigService,
        private readonly syncdayAwsSdkClientService: SyncdayAwsSdkClientService
    ) {}

    async sendEmail(recipient: string, emailTemplate: EmailTemplate, language: Language, data: string): Promise<boolean> {
        const notificationService: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify(['email'])
        };

        const body: SyncdayEmailAwsSnsRequest = {
            recipient,
            emailTemplate,
            language,
            data
        };

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
