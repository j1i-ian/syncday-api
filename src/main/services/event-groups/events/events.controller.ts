import {
    All,
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    Patch,
    Post,
    Req
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Request } from 'express';
import { DestinationPathname } from '@decorators/destination-pathname.decorator';
import { Event } from '@entity/events/event.entity';
import { UpdateEventRequestDto } from '@dto/event-groups/events/update-event-request.dto';
import { CreateEventRequestDto } from '@dto/event-groups/events/create-event-request.dto';
import { AuthUser } from '../../../decorators/auth-user.decorator';
import { AppJwtPayload } from '../../../auth/strategy/jwt/app-jwt-payload.interface';
import { EventResponseDto } from '../../../dto/event-groups/events/event-response.dto';
import { HttpMethod } from '../../../enums/http-method.enum';
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
