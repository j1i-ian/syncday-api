import { InternalServerErrorException } from '@nestjs/common';

export class CannotFindGoogleCalendarDetail extends InternalServerErrorException {
    constructor(message?: string) {
        super(message || 'Cannot find google calendar detail body');
    }
}
