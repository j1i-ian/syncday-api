import { InternalServerErrorException } from '@nestjs/common';

export class AvailabilityBodySaveFail extends InternalServerErrorException {
    constructor(message?: string) {
        super(message || 'Failed to save availability body: available times and date overrides');
    }
}
