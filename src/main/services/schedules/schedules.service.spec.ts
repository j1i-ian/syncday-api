import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { SchedulesService } from './schedules.service';

const testMockUtil = new TestMockUtil();

describe('SchedulesService', () => {
    let service: SchedulesService;

    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let schedulesRedisRepositoryStub: sinon.SinonStubbedInstance<SchedulesRedisRepository>;

    let scheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<Schedule>>;

    before(async () => {

        utilServiceStub = sinon.createStubInstance(UtilService);
        eventsServiceStub = sinon.createStubInstance(EventsService);
        schedulesRedisRepositoryStub = sinon.createStubInstance(SchedulesRedisRepository);

        scheduleRepositoryStub = sinon.createStubInstance<Repository<Schedule>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SchedulesService,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: EventsService,
                    useValue: eventsServiceStub
                },
                {
                    provide: SchedulesRedisRepository,
                    useValue: schedulesRedisRepositoryStub
                },
                {
                    provide: getRepositoryToken(Schedule),
                    useValue: scheduleRepositoryStub
                }
            ]
        }).compile();

        service = module.get<SchedulesService>(SchedulesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Scheduled event CRUD', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            eventsServiceStub.findOneByUserWorkspaceAndUUID.reset();
            utilServiceStub.getPatchedScheduledEvent.reset();
            schedulesRedisRepositoryStub.save.reset();
            scheduleRepositoryStub.save.reset();
            scheduleRepositoryStub.findBy.reset();
            scheduleRepositoryStub.findOneBy.reset();

            serviceSandbox.restore();
        });

        it('should be searched scheduled events', async () => {

            const eventUUIDMock = stubOne(Event).uuid;
            const scheduleStubs = stub(Schedule);

            scheduleRepositoryStub.findBy.resolves(scheduleStubs);

            const searchedSchedules = await firstValueFrom(
                service.search({
                    eventUUID: eventUUIDMock
                })
            );

            expect(searchedSchedules).ok;
            expect(searchedSchedules.length).greaterThan(0);
            expect(scheduleRepositoryStub.findBy.called).true;
        });

        it('should be created scheduled event', async () => {

            const userWorkspaceMock = stubOne(User).workspace as string;
            const eventStub = stubOne(Event);
            const scheduleStub = stubOne(Schedule);

            eventsServiceStub.findOneByUserWorkspaceAndUUID.resolves(eventStub);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);

            const validateStub = serviceSandbox.stub(service, 'validate').returns(of(scheduleStub));

            scheduleRepositoryStub.save.resolves(scheduleStub);
            schedulesRedisRepositoryStub.save.returns(of(scheduleStub));

            const createdSchedule = await firstValueFrom(
                service.create(
                    userWorkspaceMock, eventStub.uuid, scheduleStub
                )
            );

            expect(createdSchedule).ok;
            expect(eventsServiceStub.findOneByUserWorkspaceAndUUID.called).true;
            expect(utilServiceStub.getPatchedScheduledEvent.called).true;
            expect(validateStub.called).true;
            expect(scheduleRepositoryStub.save.called).true;
            expect(schedulesRedisRepositoryStub.save.called).true;
        });

        it('should be passed when there is no conflicted schedule ', async () => {

            const scheduleTimeMock = testMockUtil.getScheduleTimeMock();
            const scheduleMock = stubOne(Schedule, scheduleTimeMock);

            scheduleRepositoryStub.findOneBy.resolves(null);

            const validatedSchedule = await firstValueFrom(
                service.validate(
                    scheduleMock
                )
            );

            expect(validatedSchedule).ok;
            expect(scheduleRepositoryStub.findOneBy.called).true;
        });

        it('should be not passed when there are conflicted schedules ', async () => {

            const scheduleTimeMock = testMockUtil.getScheduleTimeMock();
            const scheduleMock = stubOne(Schedule, scheduleTimeMock);
            const conflictedScheduleStub = stubOne(Schedule);

            scheduleRepositoryStub.findOneBy.resolves(conflictedScheduleStub);

            await expect(
                firstValueFrom(
                    service.validate(
                        scheduleMock
                    )
                )
            ).rejectedWith(CannotCreateByInvalidTimeRange);

            expect(scheduleRepositoryStub.findOneBy.called).true;
        });
    });

});
