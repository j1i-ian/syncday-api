import { NotAcceptableException } from '@nestjs/common';

export class CannotDeleteTeamException extends NotAcceptableException {
    constructor(message?: string) {
        super(message || 'Cannot delete the team');
    }
}
