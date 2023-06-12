import { ConflictException } from '@nestjs/common';

export class AlreadyUsedInWorkspace extends ConflictException {
    constructor(message?: string) {
        super(message || 'Already used in workspace');
    }
}
