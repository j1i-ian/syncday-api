import {
    All,
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Request } from 'express';
import { DestinationPathname } from '@decorators/destination-pathname.decorator';
import { AuthUser } from '@decorators/auth-user.decorator';
import { Event } from '@entity/events/event.entity';
import { UpdateEventRequestDto } from '@dto/event-groups/events/update-event-request.dto';
import { CreateEventRequestDto } from '@dto/event-groups/events/create-event-request.dto';
import { EventResponseDto } from '@dto/event-groups/events/event-response.dto';
import { GetEventsResponseDto } from '@dto/event-groups/events/get-events-response.dto';
import { AppJwtPayload } from '../../../auth/strategy/jwt/app-jwt-payload.interface';
import { HttpMethod } from '../../../enums/http-method.enum';
import { GetEventsSearchOptions } from '../../../parameters/event-groups/events/get-events.param';
import { EventsService } from './events.service';

@Controller()
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Get()
    async findAll(
        @AuthUser() authUser: AppJwtPayload,
        @Query() getEventsSearchOptions: GetEventsSearchOptions
    ): Promise<GetEventsResponseDto[]> {
        const events = await this.eventsService.findAll(authUser.id, getEventsSearchOptions);

        return plainToInstance(GetEventsResponseDto, events, {
            excludeExtraneousValues: true
        });
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
    async update(
        @AuthUser() authUser: AppJwtPayload,
        @Param('id', new ParseIntPipe()) id: number,
        @Body() updateEventDto: UpdateEventRequestDto
    ): Promise<boolean> {
        return await this.eventsService.update(id, authUser.id, updateEventDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string): boolean {
        return this.eventsService.remove(+id);
    }

    @All(':eventId(\\d+)')
    async HttpMethodLocator(
        @AuthUser() authUser: AppJwtPayload,
        @Param('eventId') eventId: number,
        @Req() req: Request,
        @DestinationPathname() destinationPathname: string
    ): Promise<Event> {
        if (req.method === HttpMethod.COPY) {
            const copyResult = await this.copyEvent({
                userId: authUser.id,
                eventId,
                destinationPathname
            });

            return copyResult;
        } else {
            throw new NotFoundException(`Cannot ${req.method} ${req.path}`);
        }
    }

    async copyEvent({
        userId,
        eventId,
        destinationPathname
    }: {
        userId: number;
        eventId: number;
        destinationPathname: string;
    }): Promise<Event> {
        const copyResult = await this.eventsService.copyEvent(userId, eventId, destinationPathname);

        return copyResult;
    }
}
