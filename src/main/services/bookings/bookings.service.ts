import { Inject, Injectable } from '@nestjs/common';
import { Observable, from, map, mergeMap, of, reduce, tap, zip } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { HostEvent } from '@interfaces/bookings/host-event';
import { Host } from '@interfaces/bookings/host';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { GlobalScheduledEventsService } from '@services/scheduled-events/global-scheduled-events.service';
import { TeamService } from '@services/team/team.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { UtilService } from '@services/util/util.service';
import { SHARE_TIME_UTIL_SERVICE_PROVIDER } from '@services/util/share-time-util-service-provider.token';
import { Event } from '@entity/events/event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { EventStatus } from '@entity/events/event-status.enum';
import { AvailableTime } from '@entity/availability/availability-time.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { ScheduledEventResponseDto } from '@dto/scheduled-events/scheduled-event-response.dto';
import { ShareTimeUtilService } from '@share/services/share-time-util.service';

@Injectable()
export class BookingsService {

    constructor(
        private readonly teamService: TeamService,
        private readonly availabilityService: AvailabilityService,
        private readonly eventService: EventsService,
        private readonly scheduledEventsService: GlobalScheduledEventsService,
        private readonly utilService: UtilService,
        private readonly timeUtilService: TimeUtilService,
        @Inject(SHARE_TIME_UTIL_SERVICE_PROVIDER) private readonly shareTimeUtilService: ShareTimeUtilService
    ) {}

    fetchHost(
        teamWorkspace: string,
        eventLink?: string | null
    ): Observable<Host> {

        return zip([
            this.teamService.findByWorkspace(teamWorkspace),
            eventLink
                ? this.eventService.findOneByTeamWorkspaceAndLink(teamWorkspace, eventLink, {
                    defaultAvailability: false
                })
                : of(null)
        ])
            .pipe(
                map(([team, eventOrNull]) => {
                    const teamSetting = team.teamSetting;
                    const mainProfile = eventOrNull?.eventProfiles[0].profile;

                    return this.utilService.patchHost(
                        team,
                        teamSetting,
                        mainProfile,
                        eventOrNull?.type
                    );
                })
            );
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

    getHostAvailability(
        teamWorkspace: string,
        eventLink: string,
        inviteeTimezone?: string | undefined | null
    ): Observable<Availability> {

        let ensuredTimezone = inviteeTimezone as string;

        return this.availabilityService.searchByTeamWorkspaceAndLink(teamWorkspace, eventLink)
            .pipe(
                tap((availabilities) => {
                    ensuredTimezone = inviteeTimezone ?? availabilities[0].timezone;
                }),
                mergeMap((availabilities) => from(availabilities)),
                map((availability) => {

                    const availabilityTimezone = availability.timezone;

                    const normalizedWeekdayTimeRangeMap = this.shareTimeUtilService.normalizeToWeekdayTimeRangeMap(
                        availabilityTimezone,
                        ensuredTimezone,
                        availability.availableTimes
                    );
                    const normalizedAvailableTimes = [...normalizedWeekdayTimeRangeMap].map(([weekday, timeRanges]) => ({
                        day: weekday,
                        timeRanges
                    }) as AvailableTime);

                    const normalizedOverridesMap = this.shareTimeUtilService.normalizeToOverridedAvailabilityTimeRangeMap(
                        availabilityTimezone,
                        ensuredTimezone,
                        availability.overrides
                    );

                    const normalizedOverrides = [...normalizedOverridesMap.overridedTimeRangeMap].map(
                        ([yyyymmdd, timeRanges]) => {

                            const yyyy = yyyymmdd.substring(0, 4);
                            const mm = yyyymmdd.substring(4, 6);
                            const dd = yyyymmdd.substring(6, 8);

                            const utcYYYYMMDD = [yyyy, mm, dd].join('-');
                            const targetDate = new Date(`${utcYYYYMMDD}T00:00:00.000Z`);

                            return {
                                targetDate,
                                timeRanges
                            } as OverridedAvailabilityTime;
                        }
                    );

                    availability.availableTimes = normalizedAvailableTimes;
                    availability.overrides = normalizedOverrides;
                    availability.timezone = ensuredTimezone;

                    return availability;
                }),
                reduce((intersectAvailability, availability) => availability
                    ? this.timeUtilService.intersectAvailability(intersectAvailability, availability)
                    : availability)
            );
    }

    searchScheduledEvents(searchOption: Partial<ScheduledEventSearchOption>): Observable<ScheduledEventResponseDto[]> {
        return this.scheduledEventsService.search(searchOption)
            .pipe(
                map((scheduledEvents) => scheduledEvents.map(
                    (_scheduledEvent) => plainToInstance(ScheduledEventResponseDto, _scheduledEvent))
                )
            );
    }

    fetchScheduledEventOne(scheduleUUID: string): Observable<ScheduledEvent> {
        return this.scheduledEventsService.findOne(scheduleUUID);
    }

    createScheduledEvent(
        teamWorkspace: string,
        eventUUID: string,
        newScheduledEvent: ScheduledEvent
    ): Observable<ScheduledEvent> {

        const inviteeTimezone = newScheduledEvent.invitees[0].timezone;

        const hostAvailability$ = this.eventService.findOneByTeamWorkspaceAndUUID(teamWorkspace, eventUUID)
            .pipe(
                mergeMap((event) =>
                    this.getHostAvailability(
                        teamWorkspace,
                        event.link,
                        inviteeTimezone
                    )
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
                        loadedTeam.profiles.map((_profile) => {
                            const { preferredTimezone, preferredLanguage } = _profile.user.userSetting;

                            return this.utilService.convertToHostProfile(
                                _profile.user,
                                _profile,
                                teamWorkspace,
                                preferredTimezone,
                                preferredLanguage
                            );
                        }),
                        hostAvailability
                    )
                )
            );
    }
}
