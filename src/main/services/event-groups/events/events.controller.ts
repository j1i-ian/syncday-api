import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Event } from '@entity/events/event.entity';
import { CreateEventDto } from '@dto/event-groups/events/create-event.dto';
import { UpdateEventDto } from '@dto/event-groups/events/update-event.dto';
import { EventsService } from './events.service';

@Controller()
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Get()
    findAll(): Event[] {
        return this.eventsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string): Event {
        return this.eventsService.findOne(+id);
    }

    @Post()
    create(@Body() createEventDto: CreateEventDto): Event {
        return this.eventsService.create(createEventDto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto): boolean {
        return this.eventsService.update(+id, updateEventDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string): boolean {
        return this.eventsService.remove(+id);
    }
}
