import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    HttpCode,
    HttpStatus,
    ParseIntPipe
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { Event } from '@core/entities/events/event.entity';
import { AuthUser } from '@decorators/auth-user.decorator';
import { CreateEventRequestDto } from '@dto/event-groups/events/create-event-request.dto';
import { UpdateEventRequestDto } from '@dto/event-groups/events/update-event-request.dto';
import { GetEventResponseDto } from '@dto/event-groups/events/get-event-response.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Get()
    findAll(@AuthUser('id') userId: number): Observable<GetEventResponseDto[]> {
        return this.eventsService
            .search({
                userId
            })
            .pipe(
                map((list) =>
                    plainToInstance(GetEventResponseDto, list, {
                        excludeExtraneousValues: true
                    })
                )
            );
    }

    @Get(':eventId')
    findOne(@Param('eventId', ParseIntPipe) eventId: number): Observable<Event> {
        return this.eventsService.findOne(eventId);
    }

    @Post()
    create(
        @AuthUser('id') userId: number,
        @Body() createEventDto: CreateEventRequestDto
    ): Promise<Event> {
        return this.eventsService.create(userId, createEventDto as Event);
    }

    @Patch(':eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async update(
        @AuthUser('id') userId: number,
        @Param('eventId', ParseIntPipe) eventId: number,
        @Body() updateEventRequestDto: UpdateEventRequestDto
    ): Promise<void> {
        await this.eventsService.update(eventId, userId, updateEventRequestDto as Partial<Event>);
    }

    @Delete(':eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @AuthUser('id') userId: number,
        @Param('eventId', ParseIntPipe) eventId: number
    ): Promise<void> {
        await this.eventsService.remove(eventId, userId);
    }
}
