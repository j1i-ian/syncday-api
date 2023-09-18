import { Test, TestingModule } from '@nestjs/testing';
import { FindOptionsWhere, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { ScheduledEventSearchOption } from '@interfaces/schedules/scheduled-event-search-option.interface';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { Schedule } from '@entity/schedules/schedule.entity';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { ScheduledTimeset } from '@entity/schedules/scheduled-timeset.entity';
import { ScheduledBufferTime } from '@entity/schedules/scheduled-buffer-time.entity';
import { NativeSchedulesService } from './native-schedules.service';

describe('NativeSchedulesService', () => {
    let service: NativeSchedulesService;

    let integrationsServiceLocatorStub: sinon.SinonStubbedInstance<IntegrationsServiceLocator>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;

    let schedulesRedisRepositoryStub: sinon.SinonStubbedInstance<SchedulesRedisRepository>;
    let availabilityRedisRepositoryStub: sinon.SinonStubbedInstance<AvailabilityRedisRepository>;
    let scheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<Schedule>>;

    before(async () => {

        integrationsServiceLocatorStub = sinon.createStubInstance(IntegrationsServiceLocator);
        utilServiceStub = sinon.createStubInstance(UtilService);
        eventsServiceStub = sinon.createStubInstance(EventsService);

        schedulesRedisRepositoryStub = sinon.createStubInstance(SchedulesRedisRepository);
        availabilityRedisRepositoryStub = sinon.createStubInstance(AvailabilityRedisRepository);
        scheduleRepositoryStub = sinon.createStubInstance<Repository<Schedule>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NativeSchedulesService,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
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
                    provide: SchedulesRedisRepository,
                    useValue: schedulesRedisRepositoryStub
                },
                {
                    provide: AvailabilityRedisRepository,
                    useValue: availabilityRedisRepositoryStub
                },
                {
                    provide: getRepositoryToken(Schedule),
                    useValue: scheduleRepositoryStub
                }
            ]
        }).compile();

        service = module.get<NativeSchedulesService>(NativeSchedulesService);
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
            eventsServiceStub.findOneByUserWorkspaceAndUUID.reset();
            utilServiceStub.getPatchedScheduledEvent.reset();
            utilServiceStub.localizeDateTime.reset();
            integrationsServiceLocatorStub.getIntegrationFactory.reset();
            integrationsServiceLocatorStub.getFacade.reset();

            schedulesRedisRepositoryStub.save.reset();
            scheduleRepositoryStub.save.reset();
            scheduleRepositoryStub.findBy.reset();
            scheduleRepositoryStub.findOneBy.reset();
            scheduleRepositoryStub.findOneByOrFail.reset();
            scheduleRepositoryStub.update.reset();

            availabilityRedisRepositoryStub.getAvailabilityBody.reset();

            serviceSandbox.restore();
        });

        describe('Test scheduled events', () => {

            const hostUUIDMock = stubOne(User).uuid;
            const eventUUIDMock = stubOne(Event).uuid;
            const scheduleStubs = stub(Schedule);


            afterEach(() => {
                scheduleRepositoryStub.findBy.reset();
            });

            [
                {
                    description: 'should be searched scheduled events by search option (hostUUID)',
                    searchOption: {
                        hostUUID: hostUUIDMock
                    } as ScheduledEventSearchOption
                },
                {
                    description: 'should be searched scheduled events by search option (hostUUID, eventUUID)',
                    searchOption: {
                        hostUUID: hostUUIDMock,
                        eventUUID: eventUUIDMock
                    } as ScheduledEventSearchOption
                },
                {
                    description: 'should be searched scheduled events by search option (hostUUID, eventUUID, since)',
                    searchOption: {
                        hostUUID: hostUUIDMock,
                        eventUUID: eventUUIDMock,
                        since: Date.now()
                    } as ScheduledEventSearchOption
                },
                {
                    description: 'should be searched scheduled events by search option (hostUUID, eventUUID, since, until)',
                    searchOption: {
                        hostUUID: hostUUIDMock,
                        eventUUID: eventUUIDMock,
                        since: Date.now(),
                        until: Date.now() + 1000000
                    } as ScheduledEventSearchOption
                }
            ].forEach(function({
                description,
                searchOption
            }) {

                it(description, async () => {


                    scheduleRepositoryStub.findBy.resolves(scheduleStubs);

                    const searchedSchedules = await firstValueFrom(
                        service.search(searchOption)
                    );

                    expect(searchedSchedules).ok;
                    expect(searchedSchedules.length).greaterThan(0);
                    expect(scheduleRepositoryStub.findBy.called).true;

                    const actualComposedScheduledEventSearchOptions = scheduleRepositoryStub.findBy.getCall(0).args[0] as Array<FindOptionsWhere<Schedule>>;

                    expect((actualComposedScheduledEventSearchOptions[0].scheduledTime as ScheduledTimeset).startTimestamp).ok;
                    expect((actualComposedScheduledEventSearchOptions[0].scheduledTime as ScheduledTimeset).endTimestamp).ok;
                    expect((actualComposedScheduledEventSearchOptions[1].scheduledBufferTime as ScheduledBufferTime).startBufferTimestamp).ok;
                    expect((actualComposedScheduledEventSearchOptions[1].scheduledBufferTime as ScheduledBufferTime).endBufferTimestamp).ok;
                });
            });
        });
    });
});
