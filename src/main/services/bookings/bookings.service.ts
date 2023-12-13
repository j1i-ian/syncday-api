import { Injectable } from '@nestjs/common';
import { Observable, from, map, mergeMap } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { ScheduledEventSearchOption } from '@interfaces/schedules/scheduled-event-search-option.interface';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { GlobalSchedulesService } from '@services/schedules/global-schedules.service';
import { TeamService } from '@services/team/team.service';
import { Event } from '@entity/events/event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { EventStatus } from '@entity/events/event-status.enum';
import { Team } from '@entity/teams/team.entity';
import { ScheduledEventResponseDto } from '@dto/schedules/scheduled-event-response.dto';

@Injectable()
export class BookingsService {

    constructor(
        private readonly teamService: TeamService,
        private readonly availabilityService: AvailabilityService,
        private readonly eventService: EventsService,
        private readonly scheduleService: GlobalSchedulesService
    ) {}

    fetchHost(teamWorkspace: string): Observable<Team> {
        return this.teamService.findTeamByWorkspace(teamWorkspace);
    }

    searchHostEvents(teamWorkspace: string): Observable<Event[]> {
        return this.eventService.search({
            status: EventStatus.OPENED,
            public: true,
            teamWorkspace
        });
    }

    fetchHostEventDetail(teamWorkspace: string, eventLink: string): Observable<Event> {
        return this.eventService.findOneByTeamWorkspaceAndLink(teamWorkspace, eventLink);
    }

    fetchHostAvailabilityDetail(teamWorkspace: string, eventLink: string): Observable<Availability> {
        return this.availabilityService.fetchDetailByTeamWorkspaceAndLink(teamWorkspace, eventLink);
    }

    searchScheduledEvents(searchOption: ScheduledEventSearchOption): Observable<ScheduledEventResponseDto[]> {
        return this.scheduleService.search(searchOption).pipe(
            map((schedules) => schedules.map(
                (_schedule) => plainToInstance(ScheduledEventResponseDto, _schedule))
            )
        );
    }

    fetchScheduledEventOne(scheduleUUID: string): Observable<Schedule> {
        return this.scheduleService.findOne(scheduleUUID);
    }

    createScheduledEvent(teamWorkspace: string, eventUUID: string, newSchedule: Schedule): Observable<Schedule> {

        return from(this.teamService.findTeamByWorkspace(teamWorkspace))
            .pipe(
                mergeMap(
                    (loadedTeam) => this.scheduleService.create(
                        teamWorkspace,
                        eventUUID,
                        newSchedule,
                        loadedTeam,
                        loadedTeam.profiles[0].user,
                        loadedTeam.profiles[0]
                    )
                )
            );
    }
}
