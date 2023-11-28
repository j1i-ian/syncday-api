import { ConflictException } from '@nestjs/common';

export class AlreadyUsedInEventLinkException extends ConflictException {
    constructor(message?: string) {
        super(message || 'Already used in event link');
    }
}
