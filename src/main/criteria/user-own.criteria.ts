import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, FindOneOptions } from 'typeorm';
import { Event } from '@entity/events/event.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { UserResourceEntity } from '@criteria/user-resource-entity.type';
import { ResourceOwnCriteria } from './resource-own-criteria.interface';

@Injectable()
export class UserOwnCriteria implements ResourceOwnCriteria<UserResourceEntity> {
    constructor(@InjectDataSource() private readonly datasource: DataSource) {}

    async filter(
        ResourceEntityClass: new () => UserResourceEntity,
        userId: number,
        entityId: number
    ): Promise<UserResourceEntity | null> {
        const resourceEntityClassRepository = this.datasource.getRepository(ResourceEntityClass);

        const findOneOption = this.getFindOneOption(ResourceEntityClass, userId, entityId);

        const loadedResource = await resourceEntityClassRepository.findOne(findOneOption);

        return loadedResource === null ? null : loadedResource;
    }

    getException(): new () => NotAnOwnerException {
        return NotAnOwnerException;
    }

    getFindOneOption(
        ResourceEntityClass: new () => UserResourceEntity,
        userId: number,
        entityId: number
    ): FindOneOptions<UserResourceEntity> {
        let findOneOption: FindOneOptions<UserResourceEntity>;

        switch (ResourceEntityClass) {
            case Event:
                findOneOption = {
                    relations: ['eventGroup', 'eventDetail'],
                    where: {
                        id: entityId,
                        eventGroup: {
                            userId
                        }
                    }
                };
                break;
            default:
                findOneOption = {
                    where: {
                        id: entityId,
                        userId
                    }
                };
                break;
        }

        return findOneOption;
    }
}
