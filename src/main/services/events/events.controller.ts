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
    Res,
    NotImplementedException
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { Request, Response } from 'express';
import { Event } from '@core/entities/events/event.entity';
import { AuthUser } from '@decorators/auth-user.decorator';
import { Matrix } from '@decorators/matrix.decorator';
import { CreateEventRequestDto } from '@dto/event-groups/events/create-event-request.dto';
import { PatchEventRequestDto } from '@dto/event-groups/events/patch-event-request.dto';
import { FetchEventResponseDto } from '@dto/event-groups/events/fetch-event-response.dto';
import { EventsService } from './events.service';

@Controller()
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Get()
    findAll(@AuthUser('id') userId: number): Observable<FetchEventResponseDto[]> {
        return this.eventsService
            .search({
                userId
            })
            .pipe(
                map((list) =>
                    plainToInstance(FetchEventResponseDto, list, {
                        excludeExtraneousValues: true
                    })
                )
            );
    }

    @Get(':eventId')
    findOne(
        @AuthUser('id') userId: number,
        @Param('eventId', ParseIntPipe) eventId: number
    ): Observable<Event> {
        return this.eventsService.findOne(eventId, userId);
    }

    @Post()
    create(
        @AuthUser('id') userId: number,
        @AuthUser('uuid') userUUID: string,
        @Body() createEventDto: CreateEventRequestDto
    ): Promise<Event> {
        return this.eventsService.create(userUUID, userId, createEventDto as Event);
    }

    @Patch(':eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async patch(
        @AuthUser('id') userId: number,
        @Param('eventId', ParseIntPipe) eventId: number,
        @Body() patchEventRequestDto: PatchEventRequestDto
    ): Promise<void> {
        await this.eventsService.patch(eventId, userId, patchEventRequestDto as Partial<Event>);
    }

    @Delete(':eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @AuthUser('id') userId: number,
        @Param('eventId', ParseIntPipe) eventId: number
    ): Promise<void> {
        await this.eventsService.remove(eventId, userId);
    }

    clone(eventId: number, userId: number, userUUID: string): Promise<Event> {
        return this.eventsService.clone(eventId, userId, userUUID);
    }

    connectToAvailability(
        userId: number,
        eventId: number,
        availabilityId: number
    ): Promise<boolean> {
        return this.eventsService.linkToAvailability(userId, eventId, availabilityId);
    }

    /**
     * Accept http method which is not officially supported by Nest.js
     *
     * @see {@link [related stackoverflow thread](https://stackoverflow.com/questions/75513412/how-to-handle-http-copy-link-methods-in-nestjs-controller)}
     */
    @All(['', ':eventId'])
    async others(
        @Req() req: Request,
        @Res() response: Response,
        @AuthUser('id') userId: number,
        @AuthUser('uuid') userUUID: string,
        @Matrix({
            key: 'availabilityId',
            parseInt: true,
            firstOne: true
        })
        availabilityId: number
    ): Promise<void> {
        let responseBody;
        let statusCode = 500;

        const { eventId } = req.params;
        const ensuredEventId = eventId.split(';').shift() as string;
        const parsedEventId = +ensuredEventId;

        switch (req.method) {
            case 'COPY':
                responseBody = await this.clone(parsedEventId, userId, userUUID);
                statusCode = HttpStatus.CREATED;
                break;
            case 'LINK':
                await this.connectToAvailability(userId, parsedEventId, availabilityId);
                statusCode = HttpStatus.NO_CONTENT;
                break;
            default:
                throw new NotImplementedException('Not yet implemented method');
        }

        response.status(statusCode);
        if (responseBody) {
            response.json(responseBody);
        }
        response.end();
    }
}
