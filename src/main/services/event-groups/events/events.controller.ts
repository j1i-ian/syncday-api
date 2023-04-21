import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Event } from '@entity/events/event.entity';
import { UpdateEventRequestDto } from '@dto/event-groups/events/update-event-request.dto';
import { CreateEventRequestDto } from '@dto/event-groups/events/create-event-request.dto';
import { AuthUser } from '../../../decorators/auth-user.decorator';
import { AppJwtPayload } from '../../../auth/strategy/jwt/app-jwt-payload.interface';
import { EventResponseDto } from '../../../dto/event-groups/events/event-response.dto';
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
    async create(
        @AuthUser() authUser: AppJwtPayload,
        @Body() newEvent: CreateEventRequestDto
    ): Promise<EventResponseDto> {
        const event = await this.eventsService.create(authUser.id, newEvent);

        const eventResponseDto = plainToInstance(EventResponseDto, event, {
            excludeExtraneousValues: true
        });

        return eventResponseDto;
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateEventDto: UpdateEventRequestDto): boolean {
        return this.eventsService.update(+id, updateEventDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string): boolean {
        return this.eventsService.remove(+id);
    }
}
