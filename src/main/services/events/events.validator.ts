import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Observable, firstValueFrom } from 'rxjs';
import { Event } from '@entity/events/event.entity';
import { UserOwnCriteria } from '@criteria/user-own.criteria';
import { ValidationCriteria } from '@criteria/validation-criteria.interface';
import { UserResourceEntity } from '@criteria/user-resource-entity.type';

/**
 * TODO: Should be written Test
 */
@Injectable()
export class EventsValidator {
    constructor(private readonly userOwnCriteria: UserOwnCriteria) {
        this.validationCriteriaArray = [this.userOwnCriteria];
    }

    validationCriteriaArray: Array<ValidationCriteria<UserResourceEntity>>;

    async validate<T>(
        userId: number,
        resourceId: number,
        DesiredReturnEntityClassOrNull?: new () => T | null
    ): Promise<T> {
        const filteredList = await Promise.all(
            this.validationCriteriaArray.map(async (validationCriteria) => {
                const _filterPromiseOrObservable = validationCriteria.filter(
                    Event,
                    userId,
                    resourceId
                );
                const _filterPromise =
                    _filterPromiseOrObservable instanceof Observable
                        ? firstValueFrom(_filterPromiseOrObservable)
                        : _filterPromiseOrObservable;
                const _filtered = await _filterPromise;

                if (_filtered === null) {
                    const ValidationException = validationCriteria.getException();
                    throw new ValidationException();
                } else {
                    return _filtered;
                }
            })
        );

        let returnFilteredEntityInstance: T | null = null;

        if (DesiredReturnEntityClassOrNull) {
            returnFilteredEntityInstance = (filteredList.find(
                (filtered) => filtered && filtered instanceof DesiredReturnEntityClassOrNull
            ) ?? null) as T | null;

            if (returnFilteredEntityInstance === null) {
                throw new InternalServerErrorException(
                    'Cannot Find given UserResourceEntity instance while validation criteria is executed'
                );
            }
        }

        return returnFilteredEntityInstance as T;
    }
}
