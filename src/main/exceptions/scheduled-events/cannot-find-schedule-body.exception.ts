import { InternalServerErrorException } from '@nestjs/common';

export class CannotFindScheduledEventBody extends InternalServerErrorException {
    constructor(message?: string) {
        super(message || 'Cannot find schedule body');
    }
}
