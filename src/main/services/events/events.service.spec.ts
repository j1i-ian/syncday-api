import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, from } from 'rxjs';
import { Event } from '@core/entities/events/event.entity';
import { EventDetail } from '@core/entities/events/event-detail.entity';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { TestMockUtil } from '@test/test-mock-util';
import { EventsService } from './events.service';

const testMockUtil = new TestMockUtil();

describe('EventsService', () => {
    let service: EventsService;

    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;
    let eventRedisRepositoryStub: sinon.SinonStubbedInstance<EventsRedisRepository>;
    let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;

    before(async () => {
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        eventRedisRepositoryStub = sinon.createStubInstance(EventsRedisRepository);
        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventsService,
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                {
                    provide: EventsRedisRepository,
                    useValue: eventRedisRepositoryStub
                },
                {
                    provide: getRepositoryToken(Event),
                    useValue: eventRepositoryStub
                }
            ]
        }).compile();

        service = module.get<EventsService>(EventsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Event CRUD', () => {
        afterEach(() => {
            eventRepositoryStub.find.reset();
            eventRepositoryStub.findOneOrFail.reset();
            eventRedisRepositoryStub.getInviteeQuestions.reset();
            eventRedisRepositoryStub.getReminders.reset();
        });

        it('should be searched event list', async () => {
            const eventStubs = stub(Event);

            eventRepositoryStub.find.resolves(eventStubs);

            const list = await firstValueFrom(service.search({}));

            expect(list).ok;
            expect(list.length).greaterThan(0);
            expect(eventRepositoryStub.find.called).true;
        });

        it('should be fetched event detail', async () => {
            const eventDetailStub = stubOne(EventDetail);
            const eventStub = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const inviteeStubs = Array(10).fill(
                testMockUtil.getInviteeQuestionMock(eventDetailStub.uuid)
            );
            const reminderStubs = Array(10).fill(
                testMockUtil.getReminderMock(eventDetailStub.uuid)
            );

            eventRepositoryStub.findOneOrFail.resolves(eventStub);
            eventRedisRepositoryStub.getInviteeQuestions.returns(from(inviteeStubs));
            eventRedisRepositoryStub.getReminders.returns(from(reminderStubs));

            const loadedEventWithDetail = await firstValueFrom(service.findOne(eventStub.id));

            expect(loadedEventWithDetail).ok;
            expect(loadedEventWithDetail.eventDetail).ok;
            expect(eventRepositoryStub);
        });
    });
});
