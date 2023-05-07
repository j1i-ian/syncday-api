import { InternalServerErrorException } from '@nestjs/common';

export class AvailabilityUpdateFailByEntityException extends InternalServerErrorException {
    constructor(message?: string) {
        super(message || 'Availability Update fail by entity');
    }
}
