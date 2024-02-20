import { Injectable } from '@nestjs/common';
import { Observable, from, map, mergeMap, reduce, zip } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { HostEvent } from '@interfaces/bookings/host-event';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { GlobalScheduledEventsService } from '@services/scheduled-events/global-scheduled-events.service';
import { TeamService } from '@services/team/team.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { Event } from '@entity/events/event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { EventStatus } from '@entity/events/event-status.enum';
import { Team } from '@entity/teams/team.entity';
import { ScheduledEventResponseDto } from '@dto/scheduled-events/scheduled-event-response.dto';

@Injectable()
export class BookingsService {

    constructor(
        private readonly teamService: TeamService,
        private readonly availabilityService: AvailabilityService,
        private readonly eventService: EventsService,
        private readonly scheduledEventsService: GlobalScheduledEventsService,
        private readonly timeUtilService: TimeUtilService
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
                    const profileImage = event.eventProfiles[0].profile.image;

                    event.eventDetail.hostQuestions = event.eventDetail.hostQuestions ?? [];

                    return {
                        ...event,
                        profileImage
                    } as HostEvent;
                })
            );
    }

    getHostAvailability(teamWorkspace: string, eventLink: string): Observable<Availability> {
        return this.availabilityService.searchByTeamWorkspaceAndLink(teamWorkspace, eventLink)
            .pipe(
                mergeMap((availabilities) => from(availabilities)),
                reduce((intersectAvailability, availability) => availability
                    ? this.timeUtilService.intersectAvailability(intersectAvailability, availability)
                    : availability)
            );
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

        const hostAvailability$ = this.eventService.findOneByTeamWorkspaceAndUUID(teamWorkspace, eventUUID)
            .pipe(
                mergeMap((event) =>
                    this.getHostAvailability(teamWorkspace, event.link)
                )
            );

        return zip([
            this.teamService.findByWorkspace(teamWorkspace, eventUUID),
            hostAvailability$
        ])
            .pipe(
                mergeMap(
                    ([loadedTeam, hostAvailability]) => this.scheduledEventsService.create(
                        teamWorkspace,
                        eventUUID,
                        newScheduledEvent,
                        loadedTeam,
                        loadedTeam.profiles[0].user,
                        loadedTeam.profiles,
                        hostAvailability
                    )
                )
            );
    }
}
