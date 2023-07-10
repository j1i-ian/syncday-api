import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Observable, from, map, switchMap, toArray } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { BCP47AcceptLanguage } from '@decorators/accept-language.decorator';
import { Language } from '@interfaces/users/language.enum';
import { BookingsService } from '@services/bookings/bookings.service';
import { Schedule } from '@entity/schedules/schedule.entity';
import { FetchHostResponseDto } from '@dto/bookings/fetch-host-response.dto';
import { HostEventDto } from '@dto/bookings/host-event.dto';
import { HostAvailabilityDto } from '@dto/bookings/host-availability.dto';
import { CreateScheduledRequestDto } from '@dto/schedules/create-scheduled-request.dto';
import { ScheduledEventResponseDto } from '@dto/schedules/scheduled-event-response.dto';
import { Public } from '@app/auth/strategy/jwt/public.decorator';

@Controller()
@Public({ ignoreInvalidJwtToken: true })
export class BookingsController {

    constructor(
        private readonly bookingsService: BookingsService
    ) {}

    @Get('host')
    fetchHost(
        @Query('workspace') userWorkspace: string
    ): Observable<FetchHostResponseDto> {
        return this.bookingsService.fetchHost(userWorkspace)
            .pipe(map((user) => plainToInstance(FetchHostResponseDto, user, {
                excludeExtraneousValues: true
            })));
    }

    @Get('events')
    fetchHostEvents(
        @Query('workspace') userWorkspace: string
    ): Observable<HostEventDto[]> {
        return this.bookingsService.searchHostEvents(userWorkspace)
            .pipe(
                switchMap((events) => from(events)),
                map((event) => plainToInstance(HostEventDto, event, {
                    excludeExtraneousValues: true
                })),
                toArray()
            );
    }

    @Get('events/:eventLink')
    fetchHostEventDetail(
        @Query('workspace') userWorkspace: string,
        @Param('eventLink') eventLink: string
    ): Observable<HostEventDto> {
        return this.bookingsService.fetchHostEventDetail(userWorkspace, eventLink)
            .pipe(
                map((event) => plainToInstance(HostEventDto, event, {
                    excludeExtraneousValues: true
                }))
            );
    }

    @Get('availabilities')
    searchHostAvailabilities(
        @Query('workspace') userWorkspace: string,
        @Param('eventLink') eventLink: string
    ): Observable<HostAvailabilityDto> {
        return this.bookingsService.fetchHostAvailabilityDetail(userWorkspace, eventLink)
            .pipe(
                map((availability) => plainToInstance(HostAvailabilityDto, availability, {
                    excludeExtraneousValues: true
                }))
            );
    }

    @Get('scheduled-events')
    searchScheduledEvents(
        @Query('eventUUID') eventUUID: string
    ): Observable<ScheduledEventResponseDto[]> {
        return this.bookingsService.searchScheduledEvents(eventUUID)
            .pipe(
                map((searchedScheduledEvents) =>
                    searchedScheduledEvents.map((
                        _searchedScheduledEvent) =>
                        plainToInstance(ScheduledEventResponseDto, _searchedScheduledEvent, {
                            excludeExtraneousValues: true
                        })
                    ))
            );
    }

    @Get('scheduled-events/:scheduledEventUUID')
    fetchScheduledEventDetail(
        @Param('scheduledEventUUID') scheduledEventUUID: string
    ): Observable<ScheduledEventResponseDto> {
        return this.bookingsService.fetchScheduledEventOne(scheduledEventUUID)
            .pipe(
                map((fetchedScheduledEvent) =>
                    plainToInstance(ScheduledEventResponseDto, fetchedScheduledEvent, {
                        excludeExtraneousValues: true
                    })
                )
            );
    }

    @Post('scheduled-events')
    createScheduledEvent(
        @Body() createScheduleRequestDto: CreateScheduledRequestDto,
        @BCP47AcceptLanguage() language: Language
    ): Observable<ScheduledEventResponseDto> {

        const newScheduledEvent = plainToInstance(Schedule, createScheduleRequestDto, {
            strategy: 'exposeAll',
            exposeDefaultValues: true
        });
        newScheduledEvent.invitee.locale = language;

        return this.bookingsService.createScheduledEvent(
            createScheduleRequestDto.workspace,
            createScheduleRequestDto.eventUUID,
            newScheduledEvent
        ) as unknown as Observable<ScheduledEventResponseDto>;
    }
}