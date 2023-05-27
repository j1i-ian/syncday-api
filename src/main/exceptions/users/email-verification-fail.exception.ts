import { UnauthorizedException } from '@nestjs/common';

export class EmailVertificationFailException extends UnauthorizedException {
    constructor(message?: string) {
        super(message || 'Email verification code is not matched. Please try again.');
    }
}
