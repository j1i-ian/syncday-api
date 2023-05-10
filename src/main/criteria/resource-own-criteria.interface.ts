import { FindOneOptions } from 'typeorm';
import { ValidationCriteria } from '@criteria/validation-criteria.interface';

/**
 * Return Entity T when condition is matched: user has target resource
 * Otherwise, undefined is returned
 */
export interface ResourceOwnCriteria<T extends { id: number }> extends ValidationCriteria<T> {
    getFindOneOption(
        ResourceEntityClass: new () => T,
        userId: number,
        entityId: number
    ): FindOneOptions<T>;
}
