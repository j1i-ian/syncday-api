import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { Host } from '@interfaces/bookings/host';
import { Weekday } from '@interfaces/availabilities/weekday.enum';
import { NormalizedDateTimeOverrides } from '@interfaces/utils/normalized-datetime-overrides.interface';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { GlobalScheduledEventsService } from '@services/scheduled-events/global-scheduled-events.service';
import { TeamService } from '@services/team/team.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { UtilService } from '@services/util/util.service';
import { SHARE_TIME_UTIL_SERVICE_PROVIDER } from '@services/util/share-time-util-service-provider.token';
import { Event } from '@entity/events/event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { Team } from '@entity/teams/team.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { EventProfile } from '@entity/events/event-profile.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { ShareTimeUtilService } from '@share/services/share-time-util.service';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
    let service: BookingsService;
    let teamServiceStub: sinon.SinonStubbedInstance<TeamService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let availabilityServiceStub: sinon.SinonStubbedInstance<AvailabilityService>;
    let schedulesServiceStub: sinon.SinonStubbedInstance<GlobalScheduledEventsService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let timeUtilServiceStub: sinon.SinonStubbedInstance<TimeUtilService>;
    let shareTimeUtilServiceStub: sinon.SinonStubbedInstance<ShareTimeUtilService>;

    before(async () => {

        teamServiceStub = sinon.createStubInstance(TeamService);
        availabilityServiceStub = sinon.createStubInstance(AvailabilityService);
        eventsServiceStub = sinon.createStubInstance(EventsService);
        schedulesServiceStub = sinon.createStubInstance(GlobalScheduledEventsService);
        utilServiceStub = sinon.createStubInstance(UtilService);
        timeUtilServiceStub = sinon.createStubInstance(TimeUtilService);
        shareTimeUtilServiceStub = sinon.createStubInstance(ShareTimeUtilService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BookingsService,
                {
                    provide: TeamService,
                    useValue: teamServiceStub
                },
                {
                    provide: EventsService,
                    useValue: eventsServiceStub
                },
                {
                    provide: AvailabilityService,
                    useValue: availabilityServiceStub
                },
                {
                    provide: GlobalScheduledEventsService,
                    useValue: schedulesServiceStub
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: TimeUtilService,
                    useValue: timeUtilServiceStub
                },
                {
                    provide: SHARE_TIME_UTIL_SERVICE_PROVIDER,
                    useValue: shareTimeUtilServiceStub
                }
            ]
        }).compile();

        service = module.get<BookingsService>(BookingsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be fetched user', async () => {

        const teamStub = stubOne(Team, {
            teamSetting: stubOne(TeamSetting),
            profiles: [stubOne(Profile)]
        });
        const eventStub = stubOne(Event);
        const hostMock = {
            ...teamStub,
            logo: teamStub.logo,
            name: teamStub.name
        } as Host;

        teamServiceStub.findByWorkspace.returns(of(teamStub));
        eventsServiceStub.findOneByTeamWorkspaceAndLink.resolves(eventStub);
        utilServiceStub.patchHost.returns(hostMock);

        await firstValueFrom(service.fetchHost(teamStub.workspace as string, eventStub.type));

        expect(teamServiceStub.findByWorkspace.called).true;
        expect(utilServiceStub.patchHost.called).true;

        teamServiceStub.findByWorkspace.reset();
        utilServiceStub.patchHost.reset();
    });

    it('should be fetched host events', async () => {

        const teamStub = stubOne(Team);
        const eventStubs = stub(Event, 5);

        eventsServiceStub.search.returns(of(eventStubs));

        await firstValueFrom(service.searchHostEvents(teamStub.workspace as string));

        expect(eventsServiceStub.search.called).true;

        eventsServiceStub.search.reset();
    });

    it('should be fetched host event detail', async () => {

        const teamStub = stubOne(Team);
        const profileStub = stubOne(Profile);
        const eventProfileStub = stubOne(EventProfile, {
            profile: profileStub
        });
        const eventDetailStub = stubOne(EventDetail, {
            hostQuestions: []
        });
        const eventStub = stubOne(Event, {
            eventProfiles: [eventProfileStub],
            eventDetail: eventDetailStub
        });

        eventsServiceStub.findOneByTeamWorkspaceAndLink.returns(of(eventStub));

        const hostEvent = await firstValueFrom(service.fetchHostEventDetail(teamStub.workspace as string, eventStub.link));

        expect(hostEvent.profileImage).equals(profileStub.image);
        expect(eventsServiceStub.findOneByTeamWorkspaceAndLink.called).true;

        eventsServiceStub.findOneByTeamWorkspaceAndLink.reset();
    });

    it('should be fetched host availability', async () => {

        const teamWorkspaceMock = stubOne(Team).workspace;
        const eventLinkMock = stubOne(Event).link;
        const availabilityStub = stubOne(Availability);

        availabilityServiceStub.searchByTeamWorkspaceAndLink.returns(of([availabilityStub]));

        const normalizedWeekdayTimeRangeMapStub = new Map<Weekday, TimeRange[]>();
        normalizedWeekdayTimeRangeMapStub.set(Weekday.MONDAY, [{ startTime: '09:00', endTime: '18:00' }]);
        shareTimeUtilServiceStub.normalizeToWeekdayTimeRangeMap.returns(normalizedWeekdayTimeRangeMapStub);

        const normalizedOverridesMapStub = new Map<string, TimeRange[]>();
        normalizedOverridesMapStub.set('20240401', [{ startTime: '09:00', endTime: '18:00' }]);
        const normalizedOverridesStub: NormalizedDateTimeOverrides = {
            overridedDateRanges: [{
                startDateTimestamp: new Date('2024-04-01T18:00:00').getTime(),
                endDateTimestamp: new Date('2024-04-02T03:00:00').getTime()
            }],
            overridedTimeRangeMap: normalizedOverridesMapStub
        };
        shareTimeUtilServiceStub.normalizeToOverridedAvailabilityTimeRangeMap.returns(normalizedOverridesStub);

        await firstValueFrom(service.getHostAvailability(teamWorkspaceMock as string, eventLinkMock));

        expect(availabilityServiceStub.searchByTeamWorkspaceAndLink.called).true;

        availabilityServiceStub.searchByTeamWorkspaceAndLink.reset();
    });
});
