import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, from, of } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { Event } from '@core/entities/events/event.entity';
import { EventDetail } from '@core/entities/events/event-detail.entity';
import { EventGroup } from '@core/entities/events/evnet-group.entity';
import { User } from '@core/entities/users/user.entity';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { UtilService } from '@services/util/util.service';
import { Availability } from '@entity/availability/availability.entity';
import { EventsDetailBody } from '@app/interfaces/events/events-detail-body.interface';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { NoDefaultAvailabilityException } from '@app/exceptions/availability/no-default-availability.exception';
import { AlreadyUsedInEventLinkException } from '@app/exceptions/events/already-used-in-event-link.exception';
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
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    before(async () => {
        validatorStub = sinon.createStubInstance(Validator);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

        eventRedisRepositoryStub = sinon.createStubInstance(EventsRedisRepository);
        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);
        eventDetailRepositoryStub = sinon.createStubInstance<Repository<EventDetail>>(Repository);
        eventGroupRepositoryStub = sinon.createStubInstance<Repository<EventGroup>>(Repository);
        utilServiceStub = sinon.createStubInstance(UtilService);

        (eventRepositoryStub as any).manager = datasourceMock as unknown as EntityManager;

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
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
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

            eventGroupRepositoryStub.findOneOrFail.reset();

            eventRepositoryStub.find.reset();
            eventRepositoryStub.findOneOrFail.reset();
            eventRepositoryStub.save.reset();
            eventRepositoryStub.update.reset();
            eventRepositoryStub.delete.reset();

            eventRedisRepositoryStub.getInviteeQuestions.reset();
            eventRedisRepositoryStub.getNotificationInfo.reset();
            eventRedisRepositoryStub.getEventSetting.reset();
            eventRedisRepositoryStub.save.reset();
            eventRedisRepositoryStub.remove.reset();
            eventRedisRepositoryStub.clone.reset();
            eventRedisRepositoryStub.getEventLinkSetStatus.reset();
            eventRedisRepositoryStub.setEventLinkSetStatus.reset();
            eventRedisRepositoryStub.deleteEventLinkSetStatus.reset();
            eventRedisRepositoryStub.getEventDetailRecords.reset();

            eventDetailRepositoryStub.save.reset();
            eventDetailRepositoryStub.delete.reset();

            utilServiceStub.generateUniqueNumber.reset();
        });

        it('should be searched event list', async () => {
            const eventDetailStubs = stub(EventDetail, 5);
            const eventStubs = stub(Event, 5).map((_event) => {
                _event.eventDetail = eventDetailStubs.shift() as EventDetail;
                return _event;
            });
            const eventDetailsRecordStub = Object.fromEntries(eventDetailStubs.map((eventDetailStub) => [eventDetailStub.uuid, eventDetailStub]));

            eventRepositoryStub.find.resolves(eventStubs);
            eventRedisRepositoryStub.getEventDetailRecords.returns(of(eventDetailsRecordStub));

            const list = await firstValueFrom(service.search({}));

            expect(list).ok;
            expect(list.length).greaterThan(0);
            expect(eventRepositoryStub.find.called).true;
            expect(eventRedisRepositoryStub.getEventDetailRecords.called).true;
        });

        it('should be fetched event with detail', async () => {
            const eventDetailStub = stubOne(EventDetail);
            const userStub = stubOne(User);
            const eventStub = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const inviteeStubs = Array(10).fill(
                testMockUtil.getInviteeQuestionMock(eventDetailStub.uuid)
            );
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();
            const eventSettingMock = testMockUtil.getEventSettingMock();

            validatorStub.validate.resolves();
            eventRepositoryStub.findOneOrFail.resolves(eventStub);
            eventRedisRepositoryStub.getInviteeQuestions.returns(from(inviteeStubs));
            eventRedisRepositoryStub.getNotificationInfo.returns(of(notificationInfoStub));
            eventRedisRepositoryStub.getEventSetting.returns(of(eventSettingMock));

            const loadedEventWithDetail = await firstValueFrom(service.findOne(eventStub.id, userStub.id));

            expect(loadedEventWithDetail).ok;
            expect(loadedEventWithDetail.eventDetail).ok;
            expect(eventRepositoryStub);
            expect(eventRedisRepositoryStub.getInviteeQuestions.called).true;
            expect(eventRedisRepositoryStub.getNotificationInfo.called).true;
            expect(eventRedisRepositoryStub.getEventSetting.called).true;
        });

        it('should be fetched event by user workspace and event uuid with detail without redis body', async () => {
            const eventDetailStub = stubOne(EventDetail);
            const userStub = stubOne(User);
            const eventStub = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            validatorStub.validate.resolves();
            eventRepositoryStub.findOneOrFail.resolves(eventStub);
            eventRedisRepositoryStub.getNotificationInfo.returns(of(notificationInfoStub));

            const loadedEventWithDetail = await firstValueFrom(
                service.findOneByUserWorkspaceAndUUID(
                    userStub.workspace as string,
                    eventStub.uuid
                )
            );

            expect(loadedEventWithDetail).ok;
            expect(loadedEventWithDetail.eventDetail).ok;
            expect(eventRepositoryStub);
            expect(eventRedisRepositoryStub.getNotificationInfo.called).true;
        });

        it('should be fetched event by user workspace and event link with detail', async () => {
            const eventDetailStub = stubOne(EventDetail);
            const userStub = stubOne(User);
            const eventStub = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const inviteeStubs = Array(10).fill(
                testMockUtil.getInviteeQuestionMock(eventDetailStub.uuid)
            );
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();
            const eventSettingMock = testMockUtil.getEventSettingMock();

            validatorStub.validate.resolves();
            eventRepositoryStub.findOneOrFail.resolves(eventStub);
            eventRedisRepositoryStub.getInviteeQuestions.returns(from(inviteeStubs));
            eventRedisRepositoryStub.getNotificationInfo.returns(of(notificationInfoStub));
            eventRedisRepositoryStub.getEventSetting.returns(of(eventSettingMock));

            const loadedEventWithDetail = await firstValueFrom(
                service.findOneByUserWorkspaceAndLink(
                    userStub.workspace as string,
                    eventStub.link
                )
            );

            expect(loadedEventWithDetail).ok;
            expect(loadedEventWithDetail.eventDetail).ok;
            expect(eventRepositoryStub);
            expect(eventRedisRepositoryStub.getInviteeQuestions.called).true;
            expect(eventRedisRepositoryStub.getNotificationInfo.called).true;
            expect(eventRedisRepositoryStub.getEventSetting.called).true;
        });

        it('should be created event with passed name when event link is not used in', async () => {
            const defaultAvailability = stubOne(Availability);
            const userMock = stubOne(User, {
                availabilities: [defaultAvailability]
            });

            const inviteeQuestionStubs = [testMockUtil.getInviteeQuestionMock()];
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
            });
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const defaultEventGroupStub = stubOne(EventGroup, {
                user: userMock,
                events: [eventMock],
                userId: userMock.id
            });

            eventGroupRepositoryStub.findOneOrFail.resolves(defaultEventGroupStub);
            eventRedisRepositoryStub.getEventLinkSetStatus.resolves(false);
            utilServiceStub.getDefaultEvent.returns(eventMock);
            eventRepositoryStub.save.resolves(eventMock);
            eventRedisRepositoryStub.save.resolves(eventDetailBodyStub);

            const createdEvent = await service.create(userMock.uuid, userMock.id, eventMock);

            expect(createdEvent).ok;
            expect(createdEvent.name).equals(eventMock.name);
            expect(createdEvent.eventDetail).ok;
            expect(createdEvent.eventDetail.inviteeQuestions).ok;
            expect(createdEvent.eventDetail.inviteeQuestions.length).greaterThan(0);
            expect(createdEvent.eventDetail.notificationInfo).ok;

            expect(utilServiceStub.generateUniqueNumber.called).false;
            expect(eventGroupRepositoryStub.findOneOrFail.called).true;
            expect(eventRepositoryStub.save.called).true;
            expect(eventRedisRepositoryStub.save.called).true;
        });

        it('should be created event with combinded name and generated numbers when event link is used in', async () => {
            const defaultAvailability = stubOne(Availability);
            const userMock = stubOne(User, {
                availabilities: [defaultAvailability]
            });

            const inviteeQuestionStubs = [testMockUtil.getInviteeQuestionMock()];
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
            });
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const defaultEventGroupStub = stubOne(EventGroup, {
                user: userMock,
                events: [eventMock],
                userId: userMock.id
            });

            eventGroupRepositoryStub.findOneOrFail.resolves(defaultEventGroupStub);
            eventRedisRepositoryStub.getEventLinkSetStatus.resolves(true);
            utilServiceStub.getDefaultEvent.returns(eventMock);
            eventRepositoryStub.save.resolves(eventMock);
            eventRedisRepositoryStub.save.resolves(eventDetailBodyStub);

            const createdEvent = await service.create(userMock.uuid, userMock.id, eventMock);

            expect(createdEvent).ok;
            expect(createdEvent.eventDetail).ok;
            expect(createdEvent.eventDetail.inviteeQuestions).ok;
            expect(createdEvent.eventDetail.inviteeQuestions.length).greaterThan(0);
            expect(createdEvent.eventDetail.notificationInfo).ok;

            expect(utilServiceStub.generateUniqueNumber.called).true;
            expect(eventGroupRepositoryStub.findOneOrFail.called).true;
            expect(eventRepositoryStub.save.called).true;
            expect(eventRedisRepositoryStub.save.called).true;
        });

        it('should throw an error when creating an event if the default availability does not exist', () => {
            const userMock = stubOne(User, {
                availabilities: []
            });

            const inviteeQuestionStubs = [testMockUtil.getInviteeQuestionMock()];
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
            });
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const defaultEventGroupStub = stubOne(EventGroup, {
                user: userMock,
                events: [eventMock],
                userId: userMock.id
            });

            eventGroupRepositoryStub.findOneOrFail.resolves(defaultEventGroupStub);

            expect(service.create(userMock.uuid, userMock.id, eventMock)).rejectedWith(NoDefaultAvailabilityException, 'No default availability exception');
        });

        describe('Test Event Patching', () => {

            afterEach(() => {
                validatorStub.validate.reset();
                eventRedisRepositoryStub.getEventLinkSetStatus.reset();
                eventRedisRepositoryStub.deleteEventLinkSetStatus.reset();
                eventRedisRepositoryStub.setEventLinkSetStatus.reset();
                eventRepositoryStub.update.reset();
            });

            it('should be thrown an error for any event update request that does not belong to user', async () => {
                const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();
                const userMock = stubOne(User);
                const eventMock = stubOne(Event);
                const validatedEventStub = stubOne(Event, eventMock);

                validatorStub.validate.resolves(validatedEventStub);

                eventMock.link = null as any;

                validatorStub.validate.throws(new NotAnOwnerException());

                eventRepositoryStub.update.resolves(updateResultStub);

                await expect(service.patch(
                    userMock.uuid,
                    userMock.id,
                    eventMock.id,
                    eventMock
                )).rejectedWith(NotAnOwnerException);

                expect(validatorStub.validate.called).true;
                expect(eventRedisRepositoryStub.getEventLinkSetStatus.called).false;
                expect(eventRedisRepositoryStub.deleteEventLinkSetStatus.called).false;
                expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).false;
                expect(eventRepositoryStub.update.called).false;
            });

            it('should be thrown an error for already used in event link', async () => {
                const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

                const userMock = stubOne(User);
                const eventMock = stubOne(Event, {
                    link: 'fakeEventLink'
                });
                const validatedEventStub = stubOne(Event, eventMock);

                validatorStub.validate.resolves(validatedEventStub);

                eventMock.link = 'fakeNewEventLink';

                eventRedisRepositoryStub.getEventLinkSetStatus.resolves(true);
                eventRepositoryStub.update.resolves(updateResultStub);

                await expect(service.patch(
                    userMock.uuid,
                    userMock.id,
                    eventMock.id,
                    eventMock
                )).rejectedWith(AlreadyUsedInEventLinkException);

                expect(validatorStub.validate.called).true;
                expect(eventRedisRepositoryStub.getEventLinkSetStatus.called).true;
                expect(eventRedisRepositoryStub.deleteEventLinkSetStatus.called).false;
                expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).false;
                expect(eventRepositoryStub.update.called).false;
            });

            it('should be patched event', async () => {
                const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

                const userMock = stubOne(User);
                const eventMock = stubOne(Event, {
                    link: 'fakeNewEventLink'
                });
                const validatedEventStub = stubOne(Event, eventMock);
                validatedEventStub.link = 'fakeEventLink';

                validatorStub.validate.resolves(validatedEventStub);

                eventRedisRepositoryStub.getEventLinkSetStatus.resolves(false);
                eventRedisRepositoryStub.deleteEventLinkSetStatus.resolves(true);
                eventRedisRepositoryStub.setEventLinkSetStatus.resolves(true);

                eventRepositoryStub.update.resolves(updateResultStub);

                const updateResult = await service.patch(
                    userMock.uuid,
                    userMock.id,
                    eventMock.id,
                    eventMock
                );

                expect(updateResult).true;
                expect(validatorStub.validate.called).true;
                expect(eventRedisRepositoryStub.getEventLinkSetStatus.called).true;
                expect(eventRedisRepositoryStub.deleteEventLinkSetStatus.called).true;
                expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).true;
                expect(eventRepositoryStub.update.called).true;
            });

            it('should be patched event with same link', async () => {
                const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

                const userMock = stubOne(User);
                const eventMock = stubOne(Event, {
                    link: 'fakeEventLink'
                });
                const validatedEventStub = stubOne(Event, eventMock);

                validatorStub.validate.resolves(validatedEventStub);

                eventRedisRepositoryStub.getEventLinkSetStatus.resolves(false);
                eventRedisRepositoryStub.deleteEventLinkSetStatus.resolves(true);
                eventRedisRepositoryStub.setEventLinkSetStatus.resolves(true);

                eventRepositoryStub.update.resolves(updateResultStub);

                const updateResult = await service.patch(
                    userMock.uuid,
                    userMock.id,
                    eventMock.id,
                    eventMock
                );

                expect(updateResult).true;
                expect(validatorStub.validate.called).true;
                expect(eventRedisRepositoryStub.getEventLinkSetStatus.called).false;
                expect(eventRedisRepositoryStub.deleteEventLinkSetStatus.called).false;
                expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).false;
                expect(eventRepositoryStub.update.called).true;
            });
        });

        describe('Test Evnet Update', () => {

            afterEach(() => {
                validatorStub.validate.reset();
                eventRepositoryStub.findOne.reset();
                eventRedisRepositoryStub.getEventLinkSetStatus.reset();
                eventDetailRepositoryStub.findOneByOrFail.reset();
                eventRepositoryStub.update.reset();
                eventDetailRepositoryStub.update.reset();
                eventRedisRepositoryStub.deleteEventLinkSetStatus.reset();
                eventRedisRepositoryStub.setEventLinkSetStatus.reset();
            });

            it('should be thrown an error for any event update request that does not belong to requester', async () => {

                const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

                validatorStub.validate.throws(new NotAnOwnerException());

                const userMock = stubOne(User);
                const eventDetailMock = stubOne(EventDetail);
                const eventMock = stubOne(Event, {
                    eventDetail: eventDetailMock
                });

                eventRedisRepositoryStub.getEventLinkSetStatus.resolves(true);

                eventDetailRepositoryStub.findOneByOrFail.resolves(eventDetailMock);
                eventRepositoryStub.update.resolves(updateResultStub);
                eventDetailRepositoryStub.update.resolves(updateResultStub);

                await expect(service.update(
                    userMock.uuid,
                    userMock.id,
                    eventMock.id,
                    eventMock
                )).rejectedWith(NotAnOwnerException);

                expect(validatorStub.validate.called).true;
                expect(eventRedisRepositoryStub.getEventLinkSetStatus.called).false;
                expect(eventRedisRepositoryStub.deleteEventLinkSetStatus.called).false;
                expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).false;
                expect(eventRepositoryStub.update.called).false;
            });

            it('should be thrown an error if user requests the event which has a link which is already used in', async () => {

                const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

                const userMock = stubOne(User);
                const eventLinkMock = 'fake';
                const newEventLinkMock = 'fake2';
                const eventDetailMock = stubOne(EventDetail);
                const eventMock = stubOne(Event, {
                    eventDetail: eventDetailMock,
                    link: eventLinkMock
                });

                const validatedEventStub = stubOne(Event, {
                    ...eventMock,
                    eventDetail: eventDetailMock,
                    link: eventLinkMock
                });

                validatorStub.validate.resolves(validatedEventStub);
                eventRedisRepositoryStub.getEventLinkSetStatus.resolves(true);

                eventDetailRepositoryStub.findOneByOrFail.resolves(eventDetailMock);

                eventRepositoryStub.update.resolves(updateResultStub);

                eventMock.link = newEventLinkMock;

                await expect(service.update(
                    userMock.uuid,
                    userMock.id,
                    eventMock.id,
                    eventMock
                )).rejectedWith(AlreadyUsedInEventLinkException);

                expect(validatorStub.validate.called).true;
                expect(eventRedisRepositoryStub.getEventLinkSetStatus.called).true;
                expect(eventRepositoryStub.update.called).false;
                expect(eventRedisRepositoryStub.save.called).false;
                expect(eventRedisRepositoryStub.deleteEventLinkSetStatus.called).false;
                expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).false;
            });

            it('should be updated event for same link', async () => {
                const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

                const userMock = stubOne(User);
                const eventIdMock = 1;
                const eventDetailMock = stubOne(EventDetail);
                const eventMock = stubOne(Event, {
                    id: eventIdMock,
                    eventDetail: eventDetailMock
                });

                validatorStub.validate.resolves(eventMock);

                eventRedisRepositoryStub.getEventLinkSetStatus.resolves(true);

                eventDetailRepositoryStub.findOneByOrFail.resolves(eventDetailMock);

                eventRepositoryStub.update.resolves(updateResultStub);
                eventDetailRepositoryStub.update.resolves(updateResultStub);

                const updateResult = await service.update(
                    userMock.uuid,
                    userMock.id,
                    eventMock.id,
                    eventMock
                );

                expect(updateResult).true;
                expect(validatorStub.validate.called).true;
                expect(eventRedisRepositoryStub.getEventLinkSetStatus.called).true;
                expect(eventRepositoryStub.update.called).true;
                expect(eventDetailRepositoryStub.update.called).true;
                expect(eventRedisRepositoryStub.save.called).true;
                expect(eventRedisRepositoryStub.deleteEventLinkSetStatus.called).true;
                expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).true;
            });

            it('should be updated event', async () => {
                const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

                const userMock = stubOne(User);
                const eventIdMock = 1;
                const eventDetailMock = stubOne(EventDetail);
                const eventMock = stubOne(Event, {
                    id: eventIdMock,
                    eventDetail: eventDetailMock
                });

                validatorStub.validate.resolves(eventMock);

                eventRedisRepositoryStub.getEventLinkSetStatus.resolves(false);

                eventDetailRepositoryStub.findOneByOrFail.resolves(eventDetailMock);

                eventRepositoryStub.update.resolves(updateResultStub);
                eventDetailRepositoryStub.update.resolves(updateResultStub);

                const updateResult = await service.update(
                    userMock.uuid,
                    userMock.id,
                    eventMock.id,
                    eventMock
                );

                expect(updateResult).true;
                expect(validatorStub.validate.called).true;
                expect(eventRedisRepositoryStub.getEventLinkSetStatus.called).true;
                expect(eventRepositoryStub.update.called).true;
                expect(eventDetailRepositoryStub.update.called).true;
                expect(eventRedisRepositoryStub.save.called).true;
                expect(eventRedisRepositoryStub.deleteEventLinkSetStatus.called).true;
                expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).true;
            });
        });

        it('should be removed event', async () => {
            const userMock = stubOne(User);

            const inviteeQuestionStubs = [testMockUtil.getInviteeQuestionMock()];
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
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
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
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
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                inviteeQuestions: inviteeQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const [sourceEventDetailStub, clonedEventDetailStub] = stub(EventDetail, 2, {
                inviteeQuestions: eventDetailBodyStub.inviteeQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
            });
            const [sourceEventStub, clonedEventStub] = stub(Event, 2);
            sourceEventStub.eventDetail = sourceEventDetailStub;
            clonedEventStub.eventDetail = clonedEventDetailStub;

            validatorStub.validate.resolves(sourceEventStub);
            eventRepositoryStub.save.resolves(clonedEventStub);
            eventRedisRepositoryStub.clone.returns(of(eventDetailBodyStub));

            const clonedEvent = await service.clone(sourceEventDetailStub.id, userMock.id, userMock.uuid);
            expect(clonedEvent).ok;

            expect(validatorStub.validate.called).true;
            expect(eventRepositoryStub.save.called).true;
            expect(eventRedisRepositoryStub.clone.called).true;
        });

        it('should be linked to availability for event', async () => {
            const userIdMock = stubOne(User).id;
            const eventIdMock = stubOne(Event).id;
            const availabilityIdMock = stubOne(Availability).id;

            await service.linkToAvailability(userIdMock, eventIdMock, availabilityIdMock);

            expect(validatorStub.validate.calledTwice).true;
            expect(eventRepositoryStub.update.called).true;
        });
    });

    describe('Test Link / Unlink with availability', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();

            eventRepositoryStub.update.reset();
        });

        [
            {
                message:
                    'should be linked to availability which is not default and then unlink exclusive events',
                eventIdMocks: stub(Event).map((_event) => _event.id),
                availabilityIdMock: stubOne(Availability).id,
                defaultAvailabilityIdMock: stubOne(Availability).id,
                linkedEventsWithAvailabilityStubs: stub(Event),

                expectedEventRepositoryUpdateCallCount: 2
            },
            {
                message:
                    'should be linked to availability which is default and then no exclusive events',
                eventIdMocks: stub(Event).map((_event) => _event.id),
                availabilityIdMock: 1,
                defaultAvailabilityIdMock: 1,
                linkedEventsWithAvailabilityStubs: stub(Event),

                expectedEventRepositoryUpdateCallCount: 1
            },
            {
                message: 'should be linked to availability which is default and has no any events',
                eventIdMocks: stub(Event).map((_event) => _event.id),
                availabilityIdMock: stubOne(Availability).id,
                defaultAvailabilityIdMock: stubOne(Availability).id,
                linkedEventsWithAvailabilityStubs: [],

                expectedEventRepositoryUpdateCallCount: 1
            }
        ].forEach(function ({
            message,
            eventIdMocks,
            availabilityIdMock,
            defaultAvailabilityIdMock,
            linkedEventsWithAvailabilityStubs,
            expectedEventRepositoryUpdateCallCount
        }) {
            it(message, async () => {
                const userIdMock = stubOne(User).id;
                const searchStub = serviceSandbox.stub(service, 'search');
                searchStub.returns(of(linkedEventsWithAvailabilityStubs));

                const exclusiveEventsUpdateResultMock = TestMockUtil.getTypeormUpdateResultMock();
                const eventsUpdateResultMock = TestMockUtil.getTypeormUpdateResultMock();

                eventRepositoryStub.update
                    .onFirstCall()
                    .resolves(exclusiveEventsUpdateResultMock)
                    .onSecondCall()
                    .resolves(eventsUpdateResultMock);

                eventRepositoryStub.update.resolves(eventsUpdateResultMock);

                const result = await service.linksToAvailability(
                    userIdMock,
                    eventIdMocks,
                    availabilityIdMock,
                    defaultAvailabilityIdMock
                );

                expect(result).true;
                expect(searchStub.called).true;
                expect(eventRepositoryStub.update.called).true;
                expect(eventRepositoryStub.update.callCount).equals(
                    expectedEventRepositoryUpdateCallCount
                );
            });
        });

        it('should be unlinked from availability then linked to default availability', async () => {
            const availabilityIdMock = stubOne(Availability).id;
            const defaultAvailabilityIdMock = stubOne(Availability).id;

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            eventRepositoryStub.update.resolves(updateResultStub);

            const result = await service.unlinksToAvailability(
                availabilityIdMock,
                defaultAvailabilityIdMock
            );

            expect(result).true;
            expect(eventRepositoryStub.update.called).true;
        });
    });

    describe('Test validations', () => {
        afterEach(() => {
            eventRepositoryStub.find.reset();
        });

        it('should be return true if user has owned events correctly: hasOwnEvents', async () => {
            const userIdMock = stubOne(User).id;
            const eventStubs = stub(Event);

            const eventStubIds = eventStubs.map((event) => event.id);

            eventRepositoryStub.find.resolves(
                eventStubs.sort((eventA, eventB) => eventA.id - eventB.id)
            );

            const result = await service.hasOwnEvents(userIdMock, eventStubIds);

            expect(result).true;
            expect(eventRepositoryStub.find.called).true;
        });

        it('should be return true if user has owned events correctly without sorting status: hasOwnEvents', async () => {
            const userIdMock = stubOne(User).id;
            const eventStubs = stub(Event);
            eventStubs[0].id = 5;
            eventStubs[1].id = 1;
            eventStubs[2].id = 3;

            const eventStubIds = eventStubs.map((event) => event.id);

            eventRepositoryStub.find.resolves(
                eventStubs.slice().sort((eventA, eventB) => eventA.id - eventB.id)
            );

            const result = await service.hasOwnEvents(userIdMock, eventStubIds);

            expect(result).true;
            expect(eventRepositoryStub.find.called).true;
        });

        it('should be return false user has owned events particially, not all: hasOwnEvents', async () => {
            const userIdMock = stubOne(User).id;
            const eventStubs = stub(Event);

            const eventStubIds = eventStubs.map((event) => event.id);

            eventRepositoryStub.find.resolves(eventStubs);

            const result = await service.hasOwnEvents(userIdMock, eventStubIds);

            expect(result).false;
            expect(eventRepositoryStub.find.called).true;
        });

        it('should be return false user has not owned any events: hasOwnEvents', async () => {
            const userIdMock = stubOne(User).id;
            const eventIdMocks = stub(Event).map((event) => event.id);

            eventRepositoryStub.find.resolves([]);

            const result = await service.hasOwnEvents(userIdMock, eventIdMocks);

            expect(result).false;
            expect(eventRepositoryStub.find.called).true;
        });
    });

    describe('Test Validation or throw error', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        it('should be thrown error if hasOwnEvents returns false: hasOwnEventsOrThrow', async () => {
            const userIdMock = stubOne(User).id;
            const eventIdMocks = stub(Event).map((event) => event.id);

            serviceSandbox.stub(service, 'hasOwnEvents').resolves(false);

            await expect(service.hasOwnEventsOrThrow(userIdMock, eventIdMocks)).rejectedWith(
                NotAnOwnerException
            );
        });

        it('should be not thrown error if hasOwnEvents returns true: hasOwnEventsOrThrow', async () => {
            const userIdMock = stubOne(User).id;
            const eventIdMocks = stub(Event).map((event) => event.id);

            serviceSandbox.stub(service, 'hasOwnEvents').resolves(true);

            await expect(service.hasOwnEventsOrThrow(userIdMock, eventIdMocks)).fulfilled;
        });
    });
});
