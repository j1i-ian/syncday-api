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
    NotImplementedException,
    Put
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { Request, Response } from 'express';
import { Event } from '@core/entities/events/event.entity';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Matrix } from '@decorators/matrix.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { CreateEventRequestDto } from '@dto/event-groups/events/create-event-request.dto';
import { PatchEventRequestDto } from '@dto/event-groups/events/patch-event-request.dto';
import { FetchEventResponseDto } from '@dto/event-groups/events/fetch-event-response.dto';
import { UpdateEventRequestDto } from '@dto/event-groups/events/update-event-request.dto';
import { EventsService } from './events.service';

@Controller()
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Get()
    findAll(@AuthProfile('teamId') teamId: number): Observable<FetchEventResponseDto[]> {
        return this.eventsService
            .search({
                teamId
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
        @AuthProfile('teamId') teamId: number,
        @Param('eventId', ParseIntPipe) eventId: number
    ): Observable<Event> {
        return this.eventsService.findOne(eventId, teamId);
    }

    @Post()
    @Roles(Role.OWNER, Role.MANAGER)
    create(
        @AuthProfile('teamUUID') teamUUID: string,
        @AuthProfile('teamId') teamId: number,
        @Body() createEventDto: CreateEventRequestDto
    ): Promise<Event> {
        return this.eventsService.create(teamUUID, teamId, createEventDto as Event);
    }

    @Patch(':eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(Role.OWNER, Role.MANAGER)
    async patch(
        @AuthProfile('teamUUID') teamUUID: string,
        @AuthProfile('teamId') teamId: number,
        @Param('eventId', ParseIntPipe) eventId: number,
        @Body() patchEventRequestDto: PatchEventRequestDto
    ): Promise<void> {
        await this.eventsService.patch(
            teamUUID,
            teamId,
            eventId,
            patchEventRequestDto as Partial<Event>
        );
    }

    @Put(':eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(Role.OWNER, Role.MANAGER)
    async update(
        @AuthProfile('teamUUID') teamUUID: string,
        @AuthProfile('teamId') teamId: number,
        @Param('eventId', ParseIntPipe) eventId: number,
        @Body() updateEventRequestDto: UpdateEventRequestDto
    ): Promise<void> {
        await this.eventsService.update(
            teamUUID,
            teamId,
            eventId,
            updateEventRequestDto as unknown as Event
        );
    }

    @Delete(':eventId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(Role.OWNER, Role.MANAGER)
    async remove(
        @AuthProfile('teamId') teamId: number,
        @Param('eventId', ParseIntPipe) eventId: number
    ): Promise<void> {
        await this.eventsService.remove(eventId, teamId);
    }

    clone(eventId: number, teamId: number, teamUUID: string): Promise<Event> {
        return this.eventsService.clone(eventId, teamId, teamUUID);
    }

    connectToAvailability(
        teamId: number,
        eventId: number,
        availabilityId: number
    ): Promise<boolean> {
        return this.eventsService.linkToAvailability(teamId, eventId, availabilityId);
    }

    connectToProfiles(
        teamId: number,
        eventId: number,
        profileIds: number[]
    ): Promise<boolean> {
        return this.eventsService.linkToProfiles(teamId, eventId, profileIds);
    }

    /**
     * Accept http method which is not officially supported by Nest.js
     *
     * @see {@link [related stackoverflow thread](https://stackoverflow.com/questions/75513412/how-to-handle-http-copy-link-methods-in-nestjs-controller)}
     */
    @All(['', ':eventId'])
    @Roles(Role.OWNER, Role.MANAGER)
    async others(
        @Req() req: Request,
        @Res() response: Response,
        @AuthProfile('teamUUID') teamUUID: string,
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('roles') roles: Role[],
        @Matrix({
            key: 'availabilityId',
            parseInt: true,
            firstOne: true
        })
        availabilityId: number | null,
        @Matrix({
            key: 'profileId',
            parseInt: true
        })
        profileIds?: number[]
    ): Promise<void> {
        let responseBody;
        let statusCode = 500;

        const { eventId } = req.params;
        const ensuredEventId = eventId.split(';').shift() as string;
        const parsedEventId = +ensuredEventId;

        const hasManagerPermission = roles.includes(Role.MANAGER) || roles.includes(Role.OWNER);

        switch (req.method) {
            case 'COPY':
                responseBody = await this.clone(parsedEventId, teamId, teamUUID);
                statusCode = HttpStatus.CREATED;
                break;
            case 'LINK':
                if (availabilityId) {
                    await this.connectToAvailability(teamId, parsedEventId, availabilityId);

                } else if (profileIds && hasManagerPermission) {
                    await this.connectToProfiles(
                        teamId,
                        parsedEventId,
                        profileIds
                    );
                }
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
