import { ReminderTarget } from '../reminders/reminder-target.enum';
import { ReminderType } from '../reminders/reminder-type.enum';

export class ScheduledReminder {
    uuid: string;

    type: ReminderType;

    typeValue: string;

    target: ReminderTarget;

    remindBefore: string;

    scheduleUUID: string;
}
