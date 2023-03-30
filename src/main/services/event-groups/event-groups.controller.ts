import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { CreateEventGroupDto } from '@dto/event-groups/create-event-group.dto';
import { UpdateEventGroupDto } from '@dto/event-groups/update-event-group.dto';
import { EventGroupsService } from './event-groups.service';

@Controller('event-groups')
export class EventGroupsController {
    constructor(private readonly eventGroupsService: EventGroupsService) {}

    @Get()
    findAll(): EventGroup[] {
        return this.eventGroupsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string): EventGroup {
        return this.eventGroupsService.findOne(+id);
    }

    @Post()
    create(@Body() createEventGroupDto: CreateEventGroupDto): EventGroup {
        return this.eventGroupsService.create(createEventGroupDto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateEventGroupDto: UpdateEventGroupDto): boolean {
        return this.eventGroupsService.update(+id, updateEventGroupDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string): boolean {
        return this.eventGroupsService.remove(+id);
    }
}
