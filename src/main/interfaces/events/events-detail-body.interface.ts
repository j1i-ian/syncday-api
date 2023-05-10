import { InviteeQuestion } from '@core/entities/invitee-questions/invitee-question.entity';
import { Reminder } from '@core/entities/reminders/reminder.entity';

export interface EventsDetailBody {
    inviteeQuestions: InviteeQuestion[];
    reminders: Reminder[];
}
