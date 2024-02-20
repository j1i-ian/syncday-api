import { Test, TestingModule } from '@nestjs/testing';
import { FindManyOptions, FindOptionsWhere, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, of } from 'rxjs';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { InviteeAnswer } from '@interfaces/scheduled-events/invitee-answers.interface';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { ScheduledEventsRedisRepository } from '@services/scheduled-events/scheduled-events.redis-repository';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { ScheduledTimeset } from '@entity/scheduled-events/scheduled-timeset.entity';
import { ScheduledBufferTime } from '@entity/scheduled-events/scheduled-buffer-time.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { ScheduledEventBody } from '@app/interfaces/scheduled-events/schedule-body.interface';
import { NativeScheduledEventsService } from './native-scheduled-events.service';

describe('NativeScheduledEventsService', () => {
    let service: NativeScheduledEventsService;

    let integrationsServiceLocatorStub: sinon.SinonStubbedInstance<IntegrationsServiceLocator>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let timeUtilServiceStub: sinon.SinonStubbedInstance<TimeUtilService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;

    let scheduledEventsRedisRepositoryStub: sinon.SinonStubbedInstance<ScheduledEventsRedisRepository>;
    let availabilityRedisRepositoryStub: sinon.SinonStubbedInstance<AvailabilityRedisRepository>;
    let scheduledEventRepositoryStub: sinon.SinonStubbedInstance<Repository<ScheduledEvent>>;

    before(async () => {

        integrationsServiceLocatorStub = sinon.createStubInstance(IntegrationsServiceLocator);
        utilServiceStub = sinon.createStubInstance(UtilService);
        timeUtilServiceStub = sinon.createStubInstance(TimeUtilService);
        eventsServiceStub = sinon.createStubInstance(EventsService);

        scheduledEventsRedisRepositoryStub = sinon.createStubInstance(ScheduledEventsRedisRepository);
        availabilityRedisRepositoryStub = sinon.createStubInstance(AvailabilityRedisRepository);
        scheduledEventRepositoryStub = sinon.createStubInstance<Repository<ScheduledEvent>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NativeScheduledEventsService,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: TimeUtilService,
                    useValue: timeUtilServiceStub
                },
                {
                    provide: EventsService,
                    useValue: eventsServiceStub
                },
                {
                    provide: IntegrationsServiceLocator,
                    useValue: integrationsServiceLocatorStub
                },
                {
                    provide: ScheduledEventsRedisRepository,
                    useValue: scheduledEventsRedisRepositoryStub
                },
                {
                    provide: AvailabilityRedisRepository,
                    useValue: availabilityRedisRepositoryStub
                },
                {
                    provide: getRepositoryToken(ScheduledEvent),
                    useValue: scheduledEventRepositoryStub
                }
            ]
        }).compile();

        service = module.get<NativeScheduledEventsService>(NativeScheduledEventsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test for Scheduled event CRUD', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            eventsServiceStub.findOneByTeamWorkspaceAndUUID.reset();
            timeUtilServiceStub.localizeDateTime.reset();
            integrationsServiceLocatorStub.getIntegrationFactory.reset();
            integrationsServiceLocatorStub.getFacade.reset();

            scheduledEventRepositoryStub.save.reset();
            scheduledEventRepositoryStub.findBy.reset();
            scheduledEventRepositoryStub.findOneBy.reset();
            scheduledEventRepositoryStub.findOneByOrFail.reset();
            scheduledEventRepositoryStub.update.reset();

            availabilityRedisRepositoryStub.getAvailabilityBody.reset();

            serviceSandbox.restore();
        });

        describe('Test scheduled events', () => {

            const hostUUIDMock = stubOne(User).uuid;
            const eventUUIDMock = stubOne(Event).uuid;
            const scheduleStubs = stub(ScheduledEvent);


            afterEach(() => {
                scheduledEventRepositoryStub.findBy.reset();
            });

            [
                {
                    description: 'should be searched scheduled events by search option (hostUUID)',
                    searchOption: {
                        hostUUID: hostUUIDMock,
                        page: 1,
                        take: 0
                    } as ScheduledEventSearchOption
                },
                {
                    description: 'should be searched scheduled events by search option (hostUUID, eventUUID)',
                    searchOption: {
                        hostUUID: hostUUIDMock,
                        eventUUID: eventUUIDMock,
                        page: 1,
                        take: 0
                    } as ScheduledEventSearchOption
                },
                {
                    description: 'should be searched scheduled events by search option (hostUUID, eventUUID, since)',
                    searchOption: {
                        hostUUID: hostUUIDMock,
                        eventUUID: eventUUIDMock,
                        since: Date.now(),
                        page: 1,
                        take: 0
                    } as ScheduledEventSearchOption
                },
                {
                    description: 'should be searched scheduled events by search option (hostUUID, eventUUID, since, until)',
                    searchOption: {
                        hostUUID: hostUUIDMock,
                        eventUUID: eventUUIDMock,
                        since: Date.now(),
                        until: Date.now() + 1000000,
                        page: 1,
                        take: 0
                    } as ScheduledEventSearchOption
                }
            ].forEach(function({
                description,
                searchOption
            }) {

                it(description, async () => {

                    scheduledEventRepositoryStub.find.resolves(scheduleStubs);
                    scheduledEventsRedisRepositoryStub.getScheduledEventBody.returns(of({
                        inviteeAnswers: [] as InviteeAnswer[]
                    } as ScheduledEventBody));

                    const searchedSchedules = await firstValueFrom(
                        service.search(searchOption)
                    );

                    expect(searchedSchedules).ok;
                    expect(searchedSchedules.length).greaterThan(0);
                    expect(scheduledEventRepositoryStub.find.called).true;
                    expect(scheduledEventsRedisRepositoryStub.getScheduledEventBody.called).true;

                    const actualComposedScheduledEventSearchOptions = (scheduledEventRepositoryStub.find.getCall(0).args[0] as FindManyOptions<ScheduledEvent>).where as Array<FindOptionsWhere<ScheduledEvent>>;

                    expect((actualComposedScheduledEventSearchOptions[0].scheduledTime as ScheduledTimeset).startTimestamp).ok;
                    expect((actualComposedScheduledEventSearchOptions[0].scheduledTime as ScheduledTimeset).endTimestamp).ok;
                    expect((actualComposedScheduledEventSearchOptions[1].scheduledBufferTime as ScheduledBufferTime).startBufferTimestamp).ok;
                    expect((actualComposedScheduledEventSearchOptions[1].scheduledBufferTime as ScheduledBufferTime).endBufferTimestamp).ok;
                });
            });
        });
    });
});
