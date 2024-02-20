import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { InviteeAnswer } from '@interfaces/scheduled-events/invitee-answers.interface';

export interface ScheduledEventBody {

    scheduledNotificationInfo: NotificationInfo;

    inviteeAnswers: InviteeAnswer[];
}
