import { BadRequestException } from '@nestjs/common';

export class AlreadySignedUpEmailException extends BadRequestException {
    constructor(message?: string) {
        super(message || 'Already signed up email');
    }
}
