import { EmailTemplate } from '@core/interfaces/integrations/email-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/integrations/syncday-notification-publish-key.enum';
import { TextTemplate } from '@core/interfaces/integrations/text-template.enum';
import { Verification } from '@entity/verifications/verification.interface';

export interface SyncdayNotificationPublishRequest {
    notificationPublishKey: SyncdayNotificationPublishKey;
    templateType: EmailTemplate | TextTemplate;
    verificationValue: string;
    newVerification?: Pick<Verification, 'email' | 'phoneNumber'> | null | undefined;
}
