import { InviteeQuestion } from '@core/entities/invitee-questions/invitee-question.entity';
import { EventSetting } from '@interfaces/events/event-setting';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';

export interface EventsDetailBody {
    inviteeQuestions: InviteeQuestion[];
    notificationInfo: NotificationInfo;
    eventSetting: EventSetting;
}
