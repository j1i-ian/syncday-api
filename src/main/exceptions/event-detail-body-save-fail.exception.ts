import { InternalServerErrorException } from '@nestjs/common';

export class EventDetailBodySaveFailException extends InternalServerErrorException {
    constructor(message?: string) {
        super(message || 'Failed to save invitee questions or reminders');
    }
}
