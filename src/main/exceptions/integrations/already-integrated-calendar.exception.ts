import { ConflictException } from '@nestjs/common';

export class AlreadyIntegratedCalendar extends ConflictException {
    constructor(message?: string) {
        super(message || 'Already integrated calendar');
    }
}
