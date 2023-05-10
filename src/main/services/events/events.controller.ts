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
    create(@Body() createEventDto: CreateEventRequestDto): Promise<Event> {
        return this.eventsService.create(createEventDto as Event);
    }

    @Patch(':eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async update(
        @Param('eventId') eventId: string,
        @Body() updateEventDto: UpdateEventRequestDto
    ): Promise<void> {
        await this.eventsService.update(+eventId, updateEventDto);
    }

    @Delete(':eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('eventId') eventId: string): Promise<void> {
        await this.eventsService.remove(+eventId);
    }
}
