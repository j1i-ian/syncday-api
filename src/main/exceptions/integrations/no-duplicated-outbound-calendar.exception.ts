import { BadRequestException } from '@nestjs/common';

export class NoDuplicatedOutboundCalendarException extends BadRequestException {
    constructor(message?: string) {
        super(message || 'Only one calendar can be linked');
    }
}
