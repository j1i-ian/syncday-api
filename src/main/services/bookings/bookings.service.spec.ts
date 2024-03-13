import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { GlobalScheduledEventsService } from '@services/scheduled-events/global-scheduled-events.service';
import { TeamService } from '@services/team/team.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { UtilService } from '@services/util/util.service';
import { Event } from '@entity/events/event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { Team } from '@entity/teams/team.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { EventProfile } from '@entity/events/event-profile.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
    let service: BookingsService;
    let teamServiceStub: sinon.SinonStubbedInstance<TeamService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let availabilityServiceStub: sinon.SinonStubbedInstance<AvailabilityService>;
    let schedulesServiceStub: sinon.SinonStubbedInstance<GlobalScheduledEventsService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let timeUtilServiceStub: sinon.SinonStubbedInstance<TimeUtilService>;

    before(async () => {

        teamServiceStub = sinon.createStubInstance(TeamService);
        availabilityServiceStub = sinon.createStubInstance(AvailabilityService);
        eventsServiceStub = sinon.createStubInstance(EventsService);
        schedulesServiceStub = sinon.createStubInstance(GlobalScheduledEventsService);
        utilServiceStub = sinon.createStubInstance(UtilService);
        timeUtilServiceStub = sinon.createStubInstance(TimeUtilService);

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
                }
            ]
        }).compile();

        service = module.get<BookingsService>(BookingsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be fetched user', async () => {

        const teamStub = stubOne(Team);

        teamServiceStub.findByWorkspace.returns(of(teamStub));

        await firstValueFrom(service.fetchHost(teamStub.workspace as string));

        expect(teamServiceStub.findByWorkspace.called).true;

        teamServiceStub.findByWorkspace.reset();
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

        await firstValueFrom(service.getHostAvailability(teamWorkspaceMock as string, eventLinkMock));

        expect(availabilityServiceStub.searchByTeamWorkspaceAndLink.called).true;

        availabilityServiceStub.searchByTeamWorkspaceAndLink.reset();
    });
});
