import { Injectable } from '@nestjs/common';
import { Observable, from, map, mergeMap } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { HostEvent } from '@interfaces/bookings/host-event';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availabilities/availability.service';
import { GlobalScheduledEventsService } from '@services/scheduled-events/global-scheduled-events.service';
import { TeamService } from '@services/teams/team.service';
import { Event } from '@entities/events/event.entity';
import { Availability } from '@entities/availability/availability.entity';
import { ScheduledEvent } from '@entities/scheduled-events/scheduled-event.entity';
import { EventStatus } from '@entities/events/event-status.enum';
import { Team } from '@entities/teams/team.entity';
import { ScheduledEventResponseDto } from '@dto/scheduled-events/scheduled-event-response.dto';

@Injectable()
export class BookingsService {

    constructor(
        private readonly teamService: TeamService,
        private readonly availabilityService: AvailabilityService,
        private readonly eventService: EventsService,
        private readonly scheduledEventsService: GlobalScheduledEventsService
    ) {}

    fetchHost(teamWorkspace: string): Observable<Team> {
        return this.teamService.findByWorkspace(teamWorkspace);
    }

    searchHostEvents(teamWorkspace: string): Observable<Event[]> {
        return this.eventService.search({
            status: EventStatus.OPENED,
            public: true,
            teamWorkspace
        });
    }

    fetchHostEventDetail(teamWorkspace: string, eventLink: string): Observable<HostEvent> {
        return this.eventService.findOneByTeamWorkspaceAndLink(teamWorkspace, eventLink)
            .pipe(
                map((event) => {
                    const profileImage = event.availability.profile.image;

                    return {
                        ...event,
                        profileImage
                    } as HostEvent;
                })
            );
    }

    fetchHostAvailabilityDetail(teamWorkspace: string, eventLink: string): Observable<Availability> {
        return this.availabilityService.fetchDetailByTeamWorkspaceAndLink(teamWorkspace, eventLink);
    }

    searchScheduledEvents(searchOption: Partial<ScheduledEventSearchOption>): Observable<ScheduledEventResponseDto[]> {
        return this.scheduledEventsService.search(searchOption).pipe(
            map((scheduledEvents) => scheduledEvents.map(
                (_scheduledEvent) => plainToInstance(ScheduledEventResponseDto, _scheduledEvent))
            )
        );
    }

    fetchScheduledEventOne(scheduleUUID: string): Observable<ScheduledEvent> {
        return this.scheduledEventsService.findOne(scheduleUUID);
    }

    createScheduledEvent(teamWorkspace: string, eventUUID: string, newScheduledEvent: ScheduledEvent): Observable<ScheduledEvent> {

        return from(this.teamService.findByWorkspace(teamWorkspace))
            .pipe(
                mergeMap(
                    (loadedTeam) => this.scheduledEventsService.create(
                        teamWorkspace,
                        eventUUID,
                        newScheduledEvent,
                        loadedTeam,
                        loadedTeam.profiles[0].user,
                        loadedTeam.profiles[0]
                    )
                )
            );
    }
}
