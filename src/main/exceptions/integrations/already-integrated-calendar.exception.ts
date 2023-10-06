import { ConflictException } from '@nestjs/common';

export class AlreadyIntegratedCalendarException extends ConflictException {
    constructor(message?: string) {
        super(message || 'Already integrated calendar');
    }
}
