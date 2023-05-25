import { UnprocessableEntityException } from '@nestjs/common';

export class CannotDeleteDefaultAvailabilityException extends UnprocessableEntityException {
    constructor(message?: string) {
        super(message || 'Cannot delete default availability');
    }
}
