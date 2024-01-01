import { BadRequestException } from '@nestjs/common';

export class AlreadySignedUpPhoneException extends BadRequestException {
    constructor(message?: string) {
        super(message || 'Already signed up phone');
    }
}
