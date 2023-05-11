import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, from, of } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { Event } from '@core/entities/events/event.entity';
import { EventDetail } from '@core/entities/events/event-detail.entity';
import { EventGroup } from '@core/entities/events/evnet-group.entity';
import { User } from '@core/entities/users/user.entity';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { Availability } from '@entity/availability/availability.entity';
import { EventsDetailBody } from '@app/interfaces/events/events-detail-body.interface';
import { TestMockUtil } from '@test/test-mock-util';
import { Validator } from '@criteria/validator';
import { EventsService } from './events.service';

const testMockUtil = new TestMockUtil();

describe('EventsService', () => {
    let service: EventsService;

    let module: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let validatorStub: sinon.SinonStubbedInstance<Validator>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    let eventRedisRepositoryStub: sinon.SinonStubbedInstance<EventsRedisRepository>;
    let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;
    let eventDetailRepositoryStub: sinon.SinonStubbedInstance<Repository<EventDetail>>;
    let eventGroupRepositoryStub: sinon.SinonStubbedInstance<Repository<EventGroup>>;

    before(async () => {
        validatorStub = sinon.createStubInstance(Validator);
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
                    provide: Validator,
                    useValue: validatorStub
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
            validatorStub.validate.reset();

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
            eventRedisRepositoryStub.clone.reset();

            eventDetailRepositoryStub.save.reset();
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

        it('should be updated event', async () => {
            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            const userMock = stubOne(User);
            const eventMock = stubOne(Event);

            eventRepositoryStub.update.resolves(updateResultStub);

            const updateResult = await service.update(eventMock.id, userMock.id, eventMock);

            expect(updateResult).true;
            expect(validatorStub.validate.called).true;
            expect(eventRepositoryStub.update.called).true;
        });

        it('should be removed event', async () => {
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

            validatorStub.validate.resolves(eventMock);

            eventRepositoryStub.delete.resolves(deleteResultStub);
            eventDetailRepositoryStub.delete.resolves(deleteResultStub);

            const deleteResult = await service.remove(eventMock.id, userMock.id);

            expect(deleteResult).true;
            expect(validatorStub.validate.called).true;
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

            validatorStub.validate.resolves(eventMock);
            eventRepositoryStub.delete.resolves(deleteResultStub);
            eventDetailRepositoryStub.delete.resolves(deleteResultStub);

            await expect(service.remove(eventMock.id, userMock.id)).rejectedWith(
                InternalServerErrorException
            );

            expect(validatorStub.validate.called).true;
            expect(eventRepositoryStub.delete.called).true;
            expect(eventDetailRepositoryStub.delete.called).true;
            expect(eventRedisRepositoryStub.remove.called).false;
        });

        it('should be cloned event', async () => {
            const userMock = stubOne(User);

            const inviteeQuestionStubs = [testMockUtil.getInviteeQuestionMock()];
            const reminderStubs = [testMockUtil.getReminderMock()];

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                reminders: reminderStubs
            } as EventsDetailBody;

            const [sourceEventDetailStub, clonedEventDetailStub] = stub(EventDetail, 2, {
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                reminders: eventDetailBodyStub.reminders
            });
            const [sourceEventStub, clonedEventStub] = stub(Event, 2);
            sourceEventStub.eventDetail = sourceEventDetailStub;
            clonedEventStub.eventDetail = clonedEventDetailStub;

            validatorStub.validate.resolves(sourceEventStub);
            eventRepositoryStub.save.resolves(clonedEventStub);
            eventRedisRepositoryStub.clone.returns(of(eventDetailBodyStub));

            const clonedEvent = await service.clone(sourceEventDetailStub.id, userMock.id);
            expect(clonedEvent).ok;

            expect(validatorStub.validate.called).true;
            expect(eventRepositoryStub.save.called).true;
            expect(eventRedisRepositoryStub.clone.called).true;
        });

        it('should be connected to availability for event', async () => {
            const userIdMock = stubOne(User).id;
            const eventIdMock = stubOne(Event).id;
            const availabilityIdMock = stubOne(Availability).id;

            await service.connectToAvailability(userIdMock, eventIdMock, availabilityIdMock);

            expect(validatorStub.validate.calledTwice).true;
            expect(eventRepositoryStub.update.called).true;
        });
    });
});
