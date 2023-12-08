import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { GlobalSchedulesService } from '@services/schedules/global-schedules.service';
import { TeamService } from '@services/team/team.service';
import { Event } from '@entity/events/event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { Team } from '@entity/teams/team.entity';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
    let service: BookingsService;
    let teamServiceStub: sinon.SinonStubbedInstance<TeamService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let availabilityServiceStub: sinon.SinonStubbedInstance<AvailabilityService>;
    let schedulesServiceStub: sinon.SinonStubbedInstance<GlobalSchedulesService>;

    before(async () => {

        teamServiceStub = sinon.createStubInstance(TeamService);
        availabilityServiceStub = sinon.createStubInstance(AvailabilityService);
        eventsServiceStub = sinon.createStubInstance(EventsService);
        schedulesServiceStub = sinon.createStubInstance(GlobalSchedulesService);

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
                    provide: GlobalSchedulesService,
                    useValue: schedulesServiceStub
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

        teamServiceStub.findTeamByWorkspace.returns(of(teamStub));

        await firstValueFrom(service.fetchHost(teamStub.workspace as string));

        expect(teamServiceStub.findTeamByWorkspace.called).true;

        teamServiceStub.findTeamByWorkspace.reset();
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
        const eventStub = stubOne(Event);

        eventsServiceStub.findOneByTeamWorkspaceAndLink.returns(of(eventStub));

        await firstValueFrom(service.fetchHostEventDetail(teamStub.workspace as string, eventStub.link));

        expect(eventsServiceStub.findOneByTeamWorkspaceAndLink.called).true;

        eventsServiceStub.findOneByTeamWorkspaceAndLink.reset();
    });

    it('should be fetched host availability', async () => {

        const teamWorkspaceMock = stubOne(Team).workspace;
        const eventLinkMock = stubOne(Event).link;
        const availabilityStub = stubOne(Availability);

        availabilityServiceStub.fetchDetailByTeamWorkspaceAndLink.returns(of(availabilityStub));

        await firstValueFrom(service.fetchHostAvailabilityDetail(teamWorkspaceMock as string, eventLinkMock));

        expect(availabilityServiceStub.fetchDetailByTeamWorkspaceAndLink.called).true;

        availabilityServiceStub.fetchDetailByTeamWorkspaceAndLink.reset();
    });
});
