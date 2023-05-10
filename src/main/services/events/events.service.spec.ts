import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, from } from 'rxjs';
import { Event } from '@core/entities/events/event.entity';
import { EventDetail } from '@core/entities/events/event-detail.entity';
import { EventGroup } from '@core/entities/events/evnet-group.entity';
import { User } from '@core/entities/users/user.entity';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { EventsDetailBody } from '@app/interfaces/events/events-detail-body.interface';
import { TestMockUtil } from '@test/test-mock-util';
import { EventsService } from './events.service';

const testMockUtil = new TestMockUtil();

describe('EventsService', () => {
    let service: EventsService;

    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;
    let eventRedisRepositoryStub: sinon.SinonStubbedInstance<EventsRedisRepository>;
    let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;
    let eventGroupRepositoryStub: sinon.SinonStubbedInstance<Repository<EventGroup>>;

    before(async () => {
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        eventRedisRepositoryStub = sinon.createStubInstance(EventsRedisRepository);
        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);
        eventGroupRepositoryStub = sinon.createStubInstance<Repository<EventGroup>>(Repository);

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
                },
                {
                    provide: getRepositoryToken(EventGroup),
                    useValue: eventGroupRepositoryStub
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
            eventGroupRepositoryStub.findOneByOrFail.reset();

            eventRepositoryStub.find.reset();
            eventRepositoryStub.findOneOrFail.reset();
            eventRepositoryStub.save.reset();

            eventRedisRepositoryStub.getInviteeQuestions.reset();
            eventRedisRepositoryStub.getReminders.reset();
            eventRedisRepositoryStub.save.reset();
        });

        it('should be searched event list', async () => {
            const eventStubs = stub(Event);

            eventRepositoryStub.find.resolves(eventStubs);

            const list = await firstValueFrom(service.search({}));

            expect(list).ok;
            expect(list.length).greaterThan(0);
            expect(eventRepositoryStub.find.called).true;
        });

        it('should be fetched event with detail', async () => {
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

        it('should be created event', async () => {
            const userMock = stubOne(User);

            const inviteeQuestionStubs = [testMockUtil.getInviteeQuestionMock()];
            const reminderStubs = [testMockUtil.getReminderMock()];

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                reminders: reminderStubs
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                inviteeQuestions: inviteeQuestionStubs,
                reminders: reminderStubs
            });
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const defaultEventGroupStub = stubOne(EventGroup, {
                user: userMock,
                events: [eventMock],
                userId: userMock.id
            });

            eventGroupRepositoryStub.findOneByOrFail.resolves(defaultEventGroupStub);
            eventRepositoryStub.save.resolves(eventMock);
            eventRedisRepositoryStub.save.resolves(eventDetailBodyStub);

            const createdEvent = await service.create(userMock.id, eventMock);

            expect(createdEvent).ok;
            expect(createdEvent.eventDetail).ok;
            expect(createdEvent.eventDetail.inviteeQuestions).ok;
            expect(createdEvent.eventDetail.inviteeQuestions.length).greaterThan(0);
            expect(createdEvent.eventDetail.reminders).ok;
            expect(createdEvent.eventDetail.reminders.length).greaterThan(0);

            expect(eventGroupRepositoryStub.findOneByOrFail.called).true;
            expect(eventRepositoryStub.save.called).true;
            expect(eventRedisRepositoryStub.save.called).true;
        });
    });
});
