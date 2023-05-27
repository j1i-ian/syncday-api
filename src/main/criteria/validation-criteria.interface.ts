import { HttpException } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface ValidationCriteria<T extends { id: number }> {
    filter(
        EntityClass: new () => T,
        ownerSideResourceId: number,
        entityId: T['id'] extends number ? number : never
    ): Promise<T | null> | Observable<T | null>;

    getException(): new () => HttpException;
}
