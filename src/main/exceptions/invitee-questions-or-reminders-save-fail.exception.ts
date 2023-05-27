import { InternalServerErrorException } from '@nestjs/common';

export class InviteeQuestionsOrRemindersSaveFailException extends InternalServerErrorException {
    constructor(message?: string) {
        super(message || 'Failed to save invitee questions or reminders');
    }
}
