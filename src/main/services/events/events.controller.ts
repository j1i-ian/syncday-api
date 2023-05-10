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
    ParseIntPipe,
    All,
    Req,
    NotFoundException
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { Request } from 'express';
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

    async clone(userId: number, eventId: number): Promise<Event> {
        return await this.eventsService.clone(eventId, userId);
    }

    /**
     * Accept http method which is not officially supported by Nest.js
     *
     * @see {@link [related stackoverflow thread](https://stackoverflow.com/questions/75513412/how-to-handle-http-copy-link-methods-in-nestjs-controller)}
     */
    @All(['', ':eventId'])
    async others(@Req() req: Request, @AuthUser('id') userId: number | null): Promise<unknown> {
        let responseBody;

        switch (req.method) {
            case 'COPY':
                if (userId) {
                    responseBody = await this.clone(userId, +req.params.eventId);
                }
                break;
            default:
                throw new NotFoundException('Cannot found mapped method');
        }

        return responseBody;
    }
}
