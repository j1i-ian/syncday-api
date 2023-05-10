import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, from } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { Event } from '@core/entities/events/event.entity';
import { EventDetail } from '@core/entities/events/event-detail.entity';
import { EventGroup } from '@core/entities/events/evnet-group.entity';
import { User } from '@core/entities/users/user.entity';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { EventsDetailBody } from '@app/interfaces/events/events-detail-body.interface';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { EventsService } from './events.service';

const testMockUtil = new TestMockUtil();

describe('EventsService', () => {
    let service: EventsService;

    let module: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;
    let eventRedisRepositoryStub: sinon.SinonStubbedInstance<EventsRedisRepository>;
    let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;
    let eventDetailRepositoryStub: sinon.SinonStubbedInstance<Repository<EventDetail>>;
    let eventGroupRepositoryStub: sinon.SinonStubbedInstance<Repository<EventGroup>>;

    before(async () => {
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        eventRedisRepositoryStub = sinon.createStubInstance(EventsRedisRepository);
        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);
        eventDetailRepositoryStub = sinon.createStubInstance<Repository<EventDetail>>(Repository);
        eventGroupRepositoryStub = sinon.createStubInstance<Repository<EventGroup>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                EventsService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
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
                    provide: getRepositoryToken(EventDetail),
                    useValue: eventDetailRepositoryStub
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
            eventRepositoryStub.update.reset();
            eventRepositoryStub.delete.reset();

            eventRedisRepositoryStub.getInviteeQuestions.reset();
            eventRedisRepositoryStub.getReminders.reset();
            eventRedisRepositoryStub.save.reset();
            eventRedisRepositoryStub.remove.reset();

            eventDetailRepositoryStub.delete.reset();
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
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                reminders: eventDetailBodyStub.reminders
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

        it('should be updated event when user has target event', async () => {
            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            const userMock = stubOne(User);
            const eventMock = stubOne(Event);

            eventRepositoryStub.findOne.resolves(eventMock);
            eventRepositoryStub.update.resolves(updateResultStub);

            const updateResult = await service.update(eventMock.id, userMock.id, eventMock);

            expect(updateResult).true;
            expect(eventRepositoryStub.findOne.called).true;
            expect(eventRepositoryStub.update.called).true;
        });

        it('should be not updated event when user has not target event', async () => {
            const userMock = stubOne(User);
            const eventMock = stubOne(Event);

            eventRepositoryStub.findOne.resolves(null);

            await expect(service.update(eventMock.id, userMock.id, eventMock)).rejectedWith(
                NotAnOwnerException
            );

            expect(eventRepositoryStub.findOne.called).true;
        });

        it('should be removed event when user has target event', async () => {
            const userMock = stubOne(User);

            const inviteeQuestionStubs = [testMockUtil.getInviteeQuestionMock()];
            const reminderStubs = [testMockUtil.getReminderMock()];

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                reminders: reminderStubs
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                reminders: eventDetailBodyStub.reminders
            });
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailStub
            });

            const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

            eventRepositoryStub.findOne.resolves(eventMock);
            eventRepositoryStub.delete.resolves(deleteResultStub);
            eventDetailRepositoryStub.delete.resolves(deleteResultStub);

            const deleteResult = await service.remove(eventMock.id, userMock.id);

            expect(deleteResult).true;
            expect(eventRepositoryStub.findOne.called).true;
            expect(eventRepositoryStub.delete.called).true;
            expect(eventDetailRepositoryStub.delete.called).true;
            expect(eventRedisRepositoryStub.remove.called).true;
        });

        it('should not be removed if either the event removal or the removal of event detail has failed', async () => {
            const userMock = stubOne(User);

            const inviteeQuestionStubs = [testMockUtil.getInviteeQuestionMock()];
            const reminderStubs = [testMockUtil.getReminderMock()];

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                reminders: reminderStubs
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                reminders: eventDetailBodyStub.reminders
            });
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailStub
            });

            const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock(0);

            eventRepositoryStub.findOne.resolves(eventMock);
            eventRepositoryStub.delete.resolves(deleteResultStub);
            eventDetailRepositoryStub.delete.resolves(deleteResultStub);

            await expect(service.remove(eventMock.id, userMock.id)).rejectedWith(
                InternalServerErrorException
            );

            expect(eventRepositoryStub.findOne.called).true;
            expect(eventRepositoryStub.delete.called).true;
            expect(eventDetailRepositoryStub.delete.called).true;
            expect(eventRedisRepositoryStub.remove.called).false;
        });

        it('should be not removed event when user has not target event', async () => {
            const userMock = stubOne(User);
            const eventMock = stubOne(Event);

            eventRepositoryStub.findOne.resolves(null);

            await expect(service.remove(eventMock.id, userMock.id)).rejectedWith(
                NotAnOwnerException
            );

            expect(eventRepositoryStub.findOne.called).true;
            expect(eventRepositoryStub.delete.called).false;
            expect(eventDetailRepositoryStub.delete.called).false;
            expect(eventRedisRepositoryStub.remove.called).false;
        });
    });
});
