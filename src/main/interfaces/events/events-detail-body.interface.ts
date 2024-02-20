import { HostQuestion } from '@interfaces/events/event-details/host-question.interface';
import { EventSetting } from '@interfaces/events/event-setting';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';

export interface EventsDetailBody {
    hostQuestions: HostQuestion[];
    notificationInfo: NotificationInfo;
    eventSetting: EventSetting;
}
