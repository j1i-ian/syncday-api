import { ConflictException } from '@nestjs/common';

export class ZoomIntegrationFailException extends ConflictException {
    constructor(message?: string) {
        super(message || 'Failed to link with Zoom');
    }
}
