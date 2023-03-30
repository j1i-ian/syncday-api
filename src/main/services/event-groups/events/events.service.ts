/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Event } from '@entity/events/event.entity';
import { CreateEventDto } from '@dto/event-groups/events/create-event.dto';
import { UpdateEventDto } from '@dto/event-groups/events/update-event.dto';

@Injectable()
export class EventsService {
    findAll(): Event[] {
        return [] as Event[];
    }

    findOne(id: number): Event {
        return {} as Event;
    }

    create(createEventDto: CreateEventDto): Event {
        return {} as Event;
    }

    update(id: number, updateEventDto: UpdateEventDto): boolean {
        return true;
    }

    remove(id: number): boolean {
        return true;
    }
}
