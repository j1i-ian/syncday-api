import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UserService } from '@services/users/user.service';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { SchedulesService } from '@services/schedules/schedules.service';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { Schedule } from '@entity/schedules/schedule.entity';

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
            userWorkspace
        });
    }

    fetchHostEventDetail(userWorkspace: string, eventLink: string): Observable<Event> {
        return this.eventService.findOneByUserWorkspaceAndLink(userWorkspace, eventLink);
    }

    fetchHostAvailabilityDetail(userWorkspace: string, eventLink: string): Observable<Availability> {
        return this.availabilityService.fetchDetailByUserWorkspaceAndLink(userWorkspace, eventLink);
    }

    createScheduledEvent(userWorkspace: string, eventUUID: string, newSchedule: Schedule): Observable<Schedule> {
        return this.scheduleService.create(userWorkspace, eventUUID, newSchedule);
    }
}
