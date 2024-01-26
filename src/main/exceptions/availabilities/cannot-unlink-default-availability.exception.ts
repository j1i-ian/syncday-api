import { UnprocessableEntityException } from '@nestjs/common';

export class CannotUnlinkDefaultAvailabilityException extends UnprocessableEntityException {
    constructor(message?: string) {
        super(message || 'Cannot unlink from default availability');
    }
}
