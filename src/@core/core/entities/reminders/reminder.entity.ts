import { ReminderTarget } from './reminder-target.enum';
import { ReminderType } from './reminder-type.enum';

/**
 * NoSQL Entity
 */
export class Reminder {
    uuid: string;

    type: ReminderType;

    target: ReminderTarget;

    remindBefore: string;

    eventDetailUUID: string;
}
