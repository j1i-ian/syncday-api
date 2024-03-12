import { NotAcceptableException } from '@nestjs/common';

export class NoRemainingSignInMethodException extends NotAcceptableException {
    constructor(message?: string) {
        super(message || 'There is no remaining sign in method. Please do not request it');
    }
}
