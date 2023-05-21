import { BadRequestException } from '@nestjs/common';

export class NoDefaultAvailabilityException extends BadRequestException {
    constructor(message?: string) {
        super(message || 'No default availability exception');
    }
}
