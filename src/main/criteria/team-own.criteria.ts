import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, FindOneOptions } from 'typeorm';
import { Event } from '@entity/events/event.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { TeamResourceEntity } from '@criteria/team-resource-entity.type';
import { ResourceOwnCriteria } from './resource-own-criteria.interface';

@Injectable()
export class TeamOwnCriteria implements ResourceOwnCriteria<TeamResourceEntity> {
    constructor(@InjectDataSource() private readonly datasource: DataSource) {}

    async filter(
        ResourceEntityClass: new () => TeamResourceEntity,
        teamId: number,
        entityId: number
    ): Promise<TeamResourceEntity | null> {
        const resourceEntityClassRepository = this.datasource.getRepository(ResourceEntityClass);

        const findOneOption = this.getFindOneOption(ResourceEntityClass, teamId, entityId);

        const loadedResource = await resourceEntityClassRepository.findOne(findOneOption);

        return loadedResource === null ? null : loadedResource;
    }

    getException(): new () => NotAnOwnerException {
        return NotAnOwnerException;
    }

    getFindOneOption(
        ResourceEntityClass: new () => TeamResourceEntity,
        teamId: number,
        entityId: number
    ): FindOneOptions<TeamResourceEntity> {
        let findOneOption: FindOneOptions<TeamResourceEntity>;

        switch (ResourceEntityClass) {
            case Event:
                findOneOption = {
                    relations: ['eventGroup', 'eventDetail'],
                    where: {
                        id: entityId,
                        eventGroup: {
                            teamId
                        }
                    }
                };
                break;
            default:
                findOneOption = {
                    where: {
                        id: entityId,
                        teamId
                    }
                };
                break;
        }

        return findOneOption;
    }
}
