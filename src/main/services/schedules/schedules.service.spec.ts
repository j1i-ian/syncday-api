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
import { SchedulesService } from './schedules.service';

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

        afterEach(() => {
            eventsServiceStub.findOneByUserWorkspaceAndUUID.reset();
            utilServiceStub.getPatchedScheduledEvent.reset();
            scheduleRepositoryStub.save.reset();
            schedulesRedisRepositoryStub.save.reset();
        });

        it('should be created scheduled event', async () => {

            const userWorkspaceMock = stubOne(User).workspace as string;
            const eventStub = stubOne(Event);
            const scheduleStub = stubOne(Schedule);

            eventsServiceStub.findOneByUserWorkspaceAndUUID.resolves(eventStub);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);
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
            expect(scheduleRepositoryStub.save.called).true;
            expect(schedulesRedisRepositoryStub.save.called).true;
        });
    });

});
