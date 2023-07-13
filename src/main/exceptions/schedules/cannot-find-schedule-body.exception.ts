import { InternalServerErrorException } from '@nestjs/common';

export class CannotFindScheduleBody extends InternalServerErrorException {
    constructor(message?: string) {
        super(message || 'Cannot find schedule body');
    }
}
