import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { UserService } from '@services/users/user.service';
import { EventsService } from '@services/events/events.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { SchedulesService } from '@services/schedules/schedules.service';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
    let service: BookingsService;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let availabilityServiceStub: sinon.SinonStubbedInstance<AvailabilityService>;
    let schedulesServiceStub: sinon.SinonStubbedInstance<SchedulesService>;

    before(async () => {

        userServiceStub = sinon.createStubInstance(UserService);
        availabilityServiceStub = sinon.createStubInstance(AvailabilityService);
        eventsServiceStub = sinon.createStubInstance(EventsService);
        schedulesServiceStub = sinon.createStubInstance(SchedulesService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BookingsService,
                {
                    provide: UserService,
                    useValue: userServiceStub
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
                    provide: SchedulesService,
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

        const userStub = stubOne(User);

        userServiceStub.findUserByWorkspace.returns(of(userStub));

        await firstValueFrom(service.fetchHost(userStub.workspace as string));

        expect(userServiceStub.findUserByWorkspace.called).true;

        userServiceStub.findUserByWorkspace.reset();
    });

    it('should be fetched host events', async () => {

        const userStub = stubOne(User);
        const eventStubs = stub(Event, 5);

        eventsServiceStub.search.returns(of(eventStubs));

        await firstValueFrom(service.searchHostEvents(userStub.workspace as string));

        expect(eventsServiceStub.search.called).true;

        eventsServiceStub.search.reset();
    });

    it('should be fetched host event detail', async () => {

        const userStub = stubOne(User);
        const eventStub = stubOne(Event);

        eventsServiceStub.findOneByUserWorkspaceAndLink.returns(of(eventStub));

        await firstValueFrom(service.fetchHostEventDetail(userStub.workspace as string, eventStub.link));

        expect(eventsServiceStub.findOneByUserWorkspaceAndLink.called).true;

        eventsServiceStub.findOneByUserWorkspaceAndLink.reset();
    });

    it('should be fetched host availability', async () => {

        const userWorkspaceMock = stubOne(User).workspace;
        const eventLinkMock = stubOne(Event).link;
        const availabilityStub = stubOne(Availability);

        availabilityServiceStub.fetchDetailByUserWorkspaceAndLink.returns(of(availabilityStub));

        await firstValueFrom(service.fetchHostAvailabilityDetail(userWorkspaceMock as string, eventLinkMock));

        expect(availabilityServiceStub.fetchDetailByUserWorkspaceAndLink.called).true;

        availabilityServiceStub.fetchDetailByUserWorkspaceAndLink.reset();
    });
});
