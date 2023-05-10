import { BadRequestException } from '@nestjs/common';

export class NotAnOwnerException extends BadRequestException {
    constructor(message?: string) {
        super(message || 'Requested resources is not owned with requester');
    }
}
