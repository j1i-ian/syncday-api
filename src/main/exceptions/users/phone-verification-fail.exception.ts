import { UnauthorizedException } from '@nestjs/common';

export class PhoneVertificationFailException extends UnauthorizedException {
    constructor(message?: string) {
        super(message || 'Phone verification code is not matched. Please try again.');
    }
}
