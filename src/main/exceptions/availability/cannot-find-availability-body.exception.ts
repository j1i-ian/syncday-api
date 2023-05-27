import { InternalServerErrorException } from '@nestjs/common';

export class CannotFindAvailabilityBody extends InternalServerErrorException {
    constructor(message?: string) {
        super(message || 'Cannot find availability body');
    }
}
