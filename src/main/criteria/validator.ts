import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Observable, firstValueFrom } from 'rxjs';
import { TeamOwnCriteria } from '@criteria/team-own.criteria';
import { ValidationCriteria } from '@criteria/validation-criteria.interface';
import { TeamResourceEntity } from '@criteria/team-resource-entity.type';

/**
 * TODO: Should be written Test
 *
 * should support resource id array
 */
@Injectable()
export class Validator {
    constructor(private readonly teamOwnCriteria: TeamOwnCriteria) {
        this.validationCriteriaArray = [this.teamOwnCriteria];
    }

    validationCriteriaArray: Array<ValidationCriteria<TeamResourceEntity>>;

    async validate<T>(
        teamId: number,
        resourceId: number,
        ResourceEntityClass: new () => T extends TeamResourceEntity ? T : never
    ): Promise<T> {
        const filteredList = await Promise.all(
            this.validationCriteriaArray.map(async (validationCriteria) => {
                const _filterPromiseOrObservable = validationCriteria.filter(
                    ResourceEntityClass,
                    teamId,
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

        const returnFilteredEntityInstance = (filteredList.find(
            (filtered) => filtered && filtered instanceof ResourceEntityClass
        ) ?? null) as T | null;

        if (returnFilteredEntityInstance === null) {
            throw new InternalServerErrorException(
                'Cannot Find given UserResourceEntity instance while validation criteria is executed'
            );
        }

        return returnFilteredEntityInstance as T;
    }
}
