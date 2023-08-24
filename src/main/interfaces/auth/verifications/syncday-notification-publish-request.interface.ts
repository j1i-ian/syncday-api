import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { TextTemplate } from '@core/interfaces/notifications/text-template.enum';
import { Verification } from '@entity/verifications/verification.interface';

export interface SyncdayNotificationPublishRequest {
    notificationPublishKey: SyncdayNotificationPublishKey;
    templateType: EmailTemplate | TextTemplate;
    verificationValue: string;
    newVerification?: Pick<Verification, 'email' | 'phoneNumber'> | null | undefined;
}
