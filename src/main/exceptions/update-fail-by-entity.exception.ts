import { InternalServerErrorException } from '@nestjs/common';

export class UpdateFailByEntityException extends InternalServerErrorException {
    constructor(message?: string) {
        super(message || 'Update fail by entity');
    }
}
