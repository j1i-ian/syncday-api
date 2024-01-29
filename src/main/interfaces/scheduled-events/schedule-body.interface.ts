import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { InviteeAnswer } from '@interfaces/scheduled-events/invitee-answers';

export interface ScheduleBody {

    scheduledNotificationInfo: NotificationInfo;

    inviteeAnswers: InviteeAnswer[];
}
