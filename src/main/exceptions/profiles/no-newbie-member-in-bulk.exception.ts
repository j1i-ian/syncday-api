import { ConflictException } from '@nestjs/common';

export class NoNewbieMemberInBulkException extends ConflictException {
    constructor(message?: string) {
        super(message || 'No Newbie Member');
    }
}
