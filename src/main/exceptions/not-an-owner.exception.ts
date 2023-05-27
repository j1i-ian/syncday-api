import { ForbiddenException } from '@nestjs/common';

export class NotAnOwnerException extends ForbiddenException {
    constructor(message?: string) {
        super(message || 'Requested resources is not owned with requester');
    }
}
