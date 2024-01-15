import { BadRequestException } from '@nestjs/common';


export class CannotCreateByInvalidTimeRange extends BadRequestException {
    constructor(message?: string) {
        super(message || 'Cannot create by invalid time range');
    }
}
