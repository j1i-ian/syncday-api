/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { CreateEventGroupDto } from '@dto/event-groups/create-event-group.dto';
import { UpdateEventGroupDto } from '@dto/event-groups/update-event-group.dto';

@Injectable()
export class EventGroupsService {
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
}
