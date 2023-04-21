/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { CreateEventGroupDto } from '@dto/event-groups/create-event-group.dto';
import { UpdateEventGroupDto } from '@dto/event-groups/update-event-group.dto';

@Injectable()
export class EventGroupsService {
    constructor(
        @InjectRepository(EventGroup) private readonly eventGroupRepository: Repository<EventGroup>
    ) {}

    findAll(): EventGroup[] {
        return [] as EventGroup[];
    }

    findOne(id: number): EventGroup {
        return {} as EventGroup;
    }

    create(createEventGroupDto: CreateEventGroupDto): EventGroup {
        return {} as EventGroup;
    }

    update(id: number, updateEventGroupDto: UpdateEventGroupDto): boolean {
        return true;
    }

    remove(id: number): boolean {
        return true;
    }

    async findEventGroupById(eventGroupId: number, userId: number): Promise<EventGroup> {
        const eventGroup = await this.eventGroupRepository.findOneOrFail({
            where: {
                id: eventGroupId,
                userId
            }
        });

        return eventGroup;
    }

    async createDefaultEventGroup(userId: number, manager: EntityManager): Promise<EventGroup> {
        const _eventGroupRepository = manager.getRepository(EventGroup);
        const newEventGroup = _eventGroupRepository.create({
            userId
        });

        const saveResult = await _eventGroupRepository.save(newEventGroup);

        return saveResult;
    }
}
