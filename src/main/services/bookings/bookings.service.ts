import { Injectable } from '@nestjs/common';
import { Observable, from, map, mergeMap } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { UserService } from '@services/users/user.service';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { SchedulesService } from '@services/schedules/schedules.service';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { EventStatus } from '@entity/events/event-status.enum';
import { ScheduledEventResponseDto } from '@dto/schedules/scheduled-event-response.dto';

@Injectable()
export class BookingsService {

    constructor(
        private readonly userService: UserService,
        private readonly availabilityService: AvailabilityService,
        private readonly eventService: EventsService,
        private readonly scheduleService: SchedulesService
    ) {}

    fetchHost(userWorkspace: string): Observable<User> {
        return this.userService.findUserByWorkspace(userWorkspace);
    }

    searchHostEvents(userWorkspace: string): Observable<Event[]> {
        return this.eventService.search({
            status: EventStatus.OPENED,
            userWorkspace
        });
    }

    fetchHostEventDetail(userWorkspace: string, eventLink: string): Observable<Event> {
        return this.eventService.findOneByUserWorkspaceAndLink(userWorkspace, eventLink);
    }

    fetchHostAvailabilityDetail(userWorkspace: string, eventLink: string): Observable<Availability> {
        return this.availabilityService.fetchDetailByUserWorkspaceAndLink(userWorkspace, eventLink);
    }

    searchScheduledEvents(workspace: string, eventUUID: string): Observable<ScheduledEventResponseDto[]> {
        return this.scheduleService.search({
            workspace,
            eventUUID
        }).pipe(
            map((schedules) => schedules.map(
                (_schedule) => plainToInstance(ScheduledEventResponseDto, _schedule))
            )
        );
    }

    fetchScheduledEventOne(scheduleUUID: string): Observable<Schedule> {
        return this.scheduleService.findOne(scheduleUUID);
    }

    createScheduledEvent(userWorkspace: string, eventUUID: string, newSchedule: Schedule): Observable<Schedule> {

        return from(this.userService.findUserByWorkspace(userWorkspace))
            .pipe(
                map((loadedUser) => {
                    newSchedule.host = {
                        workspace: loadedUser.userSetting.workspace,
                        timezone: loadedUser.userSetting.preferredTimezone
                    };

                    return loadedUser;
                }),
                mergeMap(
                    (loadedUser) => this.scheduleService.create(
                        userWorkspace,
                        eventUUID,
                        newSchedule,
                        loadedUser.userSetting.preferredTimezone,
                        loadedUser
                    )
                )
            );
    }
}
