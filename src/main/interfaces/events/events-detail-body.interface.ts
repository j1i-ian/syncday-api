import { InviteeQuestion } from '@core/entities/invitee-questions/invitee-question.entity';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';

export interface EventsDetailBody {
    inviteeQuestions: InviteeQuestion[];
    notificationInfo: NotificationInfo;
}
