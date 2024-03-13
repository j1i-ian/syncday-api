import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, from, of } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Event } from '@core/entities/events/event.entity';
import { EventDetail } from '@core/entities/events/event-detail.entity';
import { EventGroup } from '@core/entities/events/event-group.entity';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { UtilService } from '@services/util/util.service';
import { Availability } from '@entity/availability/availability.entity';
import { Team } from '@entity/teams/team.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { EventProfile } from '@entity/events/event-profile.entity';
import { User } from '@entity/users/user.entity';
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
    let eventProfileRepositoryStub: sinon.SinonStubbedInstance<Repository<EventProfile>>;
    let profileRepositoryStub: sinon.SinonStubbedInstance<Repository<Profile>>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    before(async () => {
        validatorStub = sinon.createStubInstance(Validator);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

        eventRedisRepositoryStub = sinon.createStubInstance(EventsRedisRepository);
        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);
        eventDetailRepositoryStub = sinon.createStubInstance<Repository<EventDetail>>(Repository);
        eventGroupRepositoryStub = sinon.createStubInstance<Repository<EventGroup>>(Repository);
        eventProfileRepositoryStub = sinon.createStubInstance<Repository<EventProfile>>(Repository);
        profileRepositoryStub = sinon.createStubInstance<Repository<Profile>>(Repository);
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
                    provide: UtilService,
                    useValue: utilServiceStub
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
                    provide: getRepositoryToken(EventProfile),
                    useValue: eventProfileRepositoryStub
                },
                {
                    provide: getRepositoryToken(Profile),
                    useValue: profileRepositoryStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: TestMockUtil.getLoggerStub()
                }
            ]
        }).compile();

        service = module.get<EventsService>(EventsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Event Searching', () => {
        afterEach(() => {
            eventRepositoryStub.find.reset();

            eventRedisRepositoryStub.getEventDetailRecords.reset();
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
    });

    describe('Test Event Fetching', () => {

        afterEach(() => {
            validatorStub.validate.reset();

            eventRepositoryStub.findOneOrFail.reset();

            eventRedisRepositoryStub.getHostQuestions.reset();
            eventRedisRepositoryStub.getNotificationInfo.reset();
            eventRedisRepositoryStub.getEventSetting.reset();
        });

        it('should be fetched event with detail', async () => {
            const eventDetailStub = stubOne(EventDetail);
            const teamStub = stubOne(Team);
            const eventStub = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const inviteeStubs = Array(10).fill(
                testMockUtil.getHostQuestionMock(eventDetailStub.uuid)
            );
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();
            const eventSettingMock = testMockUtil.getEventSettingMock();

            validatorStub.validate.resolves();
            eventRepositoryStub.findOneOrFail.resolves(eventStub);
            eventRedisRepositoryStub.getHostQuestions.returns(from(inviteeStubs));
            eventRedisRepositoryStub.getNotificationInfo.returns(of(notificationInfoStub));
            eventRedisRepositoryStub.getEventSetting.returns(of(eventSettingMock));

            const loadedEventWithDetail = await firstValueFrom(service.findOne(eventStub.id, teamStub.id));

            expect(loadedEventWithDetail).ok;
            expect(loadedEventWithDetail.eventDetail).ok;
            expect(eventRepositoryStub.findOneOrFail.called).true;
            expect(eventRedisRepositoryStub.getHostQuestions.called).true;
            expect(eventRedisRepositoryStub.getNotificationInfo.called).true;
            expect(eventRedisRepositoryStub.getEventSetting.called).true;
        });

        it('should be fetched event by team workspace and event uuid with detail without redis body', async () => {
            const eventDetailStub = stubOne(EventDetail);
            const teamStub = stubOne(Team);
            const eventStub = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            validatorStub.validate.resolves();
            eventRepositoryStub.findOneOrFail.resolves(eventStub);
            eventRedisRepositoryStub.getNotificationInfo.returns(of(notificationInfoStub));

            const loadedEventWithDetail = await firstValueFrom(
                service.findOneByTeamWorkspaceAndUUID(
                    teamStub.workspace as string,
                    eventStub.uuid
                )
            );

            expect(loadedEventWithDetail).ok;
            expect(loadedEventWithDetail.eventDetail).ok;
            expect(eventRepositoryStub.findOneOrFail.called).true;
            expect(eventRedisRepositoryStub.getNotificationInfo.called).true;
        });

        it('should be fetched event by team workspace and event link with detail', async () => {
            const eventDetailStub = stubOne(EventDetail);
            const teamStub = stubOne(Team);
            const eventStub = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const inviteeStubs = Array(10).fill(
                testMockUtil.getHostQuestionMock(eventDetailStub.uuid)
            );
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();
            const eventSettingMock = testMockUtil.getEventSettingMock();

            validatorStub.validate.resolves();
            eventRepositoryStub.findOneOrFail.resolves(eventStub);
            eventRedisRepositoryStub.getHostQuestions.returns(of(inviteeStubs));
            eventRedisRepositoryStub.getNotificationInfo.returns(of(notificationInfoStub));
            eventRedisRepositoryStub.getEventSetting.returns(of(eventSettingMock));

            const loadedEventWithDetail = await firstValueFrom(
                service.findOneByTeamWorkspaceAndLink(
                    teamStub.workspace as string,
                    eventStub.link
                )
            );

            expect(loadedEventWithDetail).ok;
            expect(loadedEventWithDetail.eventDetail).ok;
            expect(eventRepositoryStub.findOneOrFail.called).true;
            expect(eventRedisRepositoryStub.getHostQuestions.called).true;
            expect(eventRedisRepositoryStub.getNotificationInfo.called).true;
            expect(eventRedisRepositoryStub.getEventSetting.called).true;
        });

    });

    describe('Test Event Creating', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {

            eventGroupRepositoryStub.findOneOrFail.reset();

            eventRedisRepositoryStub.getEventLinkSetStatus.reset();

            utilServiceStub.generateUniqueNumber.reset();

            serviceSandbox.restore();
        });

        it('should be created event with passed name when event link is not used in', async () => {

            const eventMockStub = stubOne(Event);

            const defaultAvailability = stubOne(Availability);
            const profileMock = stubOne(Profile, {
                availabilities: [defaultAvailability]
            });
            const teamMock = stubOne(Team, {
                profiles: [profileMock]
            });
            const defaultEventGroupStub = stubOne(EventGroup, {
                team: teamMock
            });
            const isAlreadyUsedInStub = false;

            eventGroupRepositoryStub.findOneOrFail.resolves(defaultEventGroupStub);
            eventRedisRepositoryStub.getEventLinkSetStatus.resolves(isAlreadyUsedInStub);

            const coreCreateStub = serviceSandbox.stub(service, '_create');
            coreCreateStub.resolves(eventMockStub);

            const teamUUIDDummy = teamMock.uuid;
            const createdEvent = await service.create(
                teamUUIDDummy,
                teamMock.id,
                profileMock.id,
                eventMockStub
            );

            expect(createdEvent).ok;
            expect(createdEvent.name).equals(eventMockStub.name);

            expect(utilServiceStub.generateUniqueNumber.called).false;

            expect(coreCreateStub.called).true;
        });

        it('should be created event with combinded name and generated numbers when event link is used in', async () => {
            const defaultAvailability = stubOne(Availability);
            const profileMock = stubOne(Profile, {
                availabilities: [defaultAvailability]
            });
            const teamMock = stubOne(Team, {
                profiles: [profileMock]
            });

            const eventMockStub = stubOne(Event);
            const defaultEventGroupStub = stubOne(EventGroup, {
                team: teamMock,
                teamId: teamMock.id
            });
            const isAlreadyUsedInStub = true;

            eventGroupRepositoryStub.findOneOrFail.resolves(defaultEventGroupStub);

            eventRedisRepositoryStub.getEventLinkSetStatus.resolves(isAlreadyUsedInStub);

            const coreCreateStub = serviceSandbox.stub(service, '_create');
            coreCreateStub.resolves(eventMockStub);

            const teamUUIDDummy = teamMock.uuid;
            const createdEvent = await service.create(
                teamUUIDDummy,
                teamMock.id,
                profileMock.id,
                eventMockStub
            );

            expect(createdEvent).ok;
            expect(utilServiceStub.generateUniqueNumber.called).true;

            expect(coreCreateStub.called).true;
        });

        it('should be thrown an error on event creating when creating an event if the default availability does not exist', () => {
            const defaultAvailability = stubOne(Availability);
            const profileMock = stubOne(Profile, {
                availabilities: [defaultAvailability]
            });
            const teamMock = stubOne(Team, {
                profiles: [profileMock]
            });

            const hostQuestionStubs = [testMockUtil.getHostQuestionMock()];
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                hostQuestions: hostQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                hostQuestions: eventDetailBodyStub.hostQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
            });
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const defaultEventGroupStub = stubOne(EventGroup, {
                team: teamMock,
                events: [eventMock],
                teamId: teamMock.id
            });

            eventGroupRepositoryStub.findOneOrFail.resolves(defaultEventGroupStub);

            expect(service.create(
                teamMock.uuid,
                teamMock.id,
                profileMock.id,
                eventMock
            )).rejectedWith(NoDefaultAvailabilityException, 'No default availability exception');
        });
    });

    describe('Test Event Creating with transaction', () => {

        afterEach(() => {
            utilServiceStub.getDefaultEvent.reset();

            eventRepositoryStub.save.reset();
            eventRedisRepositoryStub.save.reset();
            eventRedisRepositoryStub.setEventLinkSetStatus.reset();
        });

        it('should be created an event with transaction' , async () => {
            const hostQuestionStubs = [testMockUtil.getHostQuestionMock()];
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();
            const userMock = stubOne(User);

            const eventDetailBodyStub = {
                hostQuestions: hostQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                hostQuestions: eventDetailBodyStub.hostQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
            });
            const eventMockStub = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const profileMock = stubOne(Profile);
            const availabilityMock = stubOne(Availability);

            utilServiceStub.getDefaultEvent.returns(eventMockStub);
            eventRepositoryStub.save.resolves(eventMockStub);
            eventRedisRepositoryStub.save.resolves(eventDetailBodyStub);

            const teamUUIDDummy = stubOne(Team).uuid;

            const createdEvent = await service._create(
                datasourceMock as unknown as EntityManager,
                teamUUIDDummy,
                profileMock.id,
                availabilityMock.id,
                eventMockStub,
                userMock
            );

            expect(createdEvent.eventDetail).ok;
            expect(createdEvent.eventDetail.hostQuestions).ok;
            expect(createdEvent.eventDetail.hostQuestions.length).greaterThan(0);
            expect(createdEvent.eventDetail.notificationInfo).ok;

            expect(eventRepositoryStub.save.called).true;
            expect(eventRedisRepositoryStub.save.called).true;

            expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).true;
        });
    });

    // TODO: Parameterizing
    describe('Test Event Patching', () => {

        afterEach(() => {
            validatorStub.validate.reset();
            eventRedisRepositoryStub.getEventLinkSetStatus.reset();
            eventRedisRepositoryStub.deleteEventLinkSetStatus.reset();
            eventRedisRepositoryStub.setEventLinkSetStatus.reset();
            eventRepositoryStub.update.reset();
        });

        it('should be thrown an error for any event update request that does not belong to team', async () => {
            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();
            const teamMock = stubOne(Team);
            const eventMock = stubOne(Event);
            const validatedEventStub = stubOne(Event, eventMock);

            validatorStub.validate.resolves(validatedEventStub);

            eventMock.link = null as any;

            validatorStub.validate.throws(new NotAnOwnerException());

            eventRepositoryStub.update.resolves(updateResultStub);

            await expect(service.patch(
                teamMock.uuid,
                teamMock.id,
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

            const teamMock = stubOne(Team);
            const eventMock = stubOne(Event, {
                link: 'fakeEventLink'
            });
            const validatedEventStub = stubOne(Event, eventMock);

            validatorStub.validate.resolves(validatedEventStub);

            eventMock.link = 'fakeNewEventLink';

            eventRedisRepositoryStub.getEventLinkSetStatus.resolves(true);
            eventRepositoryStub.update.resolves(updateResultStub);

            await expect(service.patch(
                teamMock.uuid,
                teamMock.id,
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

            const teamMock = stubOne(Team);
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
                teamMock.uuid,
                teamMock.id,
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

            const teamMock = stubOne(Team);
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
                teamMock.uuid,
                teamMock.id,
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

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            validatorStub.validate.reset();

            eventRedisRepositoryStub.getEventLinkSetStatus.reset();

            eventRepositoryStub.update.reset();
            eventDetailRepositoryStub.update.reset();

            eventRepositoryStub.findOne.reset();
            eventDetailRepositoryStub.findOneByOrFail.reset();
            eventRedisRepositoryStub.deleteEventLinkSetStatus.reset();
            eventRedisRepositoryStub.setEventLinkSetStatus.reset();

            serviceSandbox.restore();
        });

        it('should be thrown an error for any event update request that does not belong to requester', async () => {

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            validatorStub.validate.throws(new NotAnOwnerException());

            const teamMock = stubOne(Team);
            const eventDetailMock = stubOne(EventDetail);
            const newHosts = stub(EventProfile);
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailMock,
                eventProfiles: newHosts
            });

            eventRedisRepositoryStub.getEventLinkSetStatus.resolves(true);

            eventDetailRepositoryStub.findOneByOrFail.resolves(eventDetailMock);
            eventRepositoryStub.update.resolves(updateResultStub);

            serviceSandbox.stub(service, '_linkToProfiles').resolves(true);

            eventDetailRepositoryStub.update.resolves(updateResultStub);

            await expect(service.update(
                teamMock.uuid,
                teamMock.id,
                eventMock.id,
                eventMock
            )).rejectedWith(NotAnOwnerException);

            expect(validatorStub.validate.called).true;
            expect(eventRedisRepositoryStub.getEventLinkSetStatus.called).false;
            expect(eventRedisRepositoryStub.deleteEventLinkSetStatus.called).false;
            expect(eventRedisRepositoryStub.setEventLinkSetStatus.called).false;
            expect(eventRepositoryStub.update.called).false;
        });

        it('should be thrown an error if team requests the event which has a link which is already used in', async () => {

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            const teamMock = stubOne(Team);
            const eventLinkMock = 'fake';
            const newEventLinkMock = 'fake2';
            const eventDetailMock = stubOne(EventDetail);
            const newHosts = stub(EventProfile);
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailMock,
                link: eventLinkMock,
                eventProfiles: newHosts
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

            serviceSandbox.stub(service, '_linkToProfiles').resolves(true);

            eventMock.link = newEventLinkMock;

            await expect(service.update(
                teamMock.uuid,
                teamMock.id,
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

            const teamMock = stubOne(Team);
            const eventIdMock = 1;
            const eventDetailMock = stubOne(EventDetail);
            const newHosts = stub(EventProfile);
            const eventMock = stubOne(Event, {
                id: eventIdMock,
                eventDetail: eventDetailMock,
                eventProfiles: newHosts
            });

            validatorStub.validate.resolves(eventMock);

            eventRedisRepositoryStub.getEventLinkSetStatus.resolves(true);

            eventDetailRepositoryStub.findOneByOrFail.resolves(eventDetailMock);

            eventRepositoryStub.update.resolves(updateResultStub);

            serviceSandbox.stub(service, '_linkToProfiles').resolves(true);

            eventDetailRepositoryStub.update.resolves(updateResultStub);

            const updateResult = await service.update(
                teamMock.uuid,
                teamMock.id,
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

            const teamMock = stubOne(Team);
            const eventIdMock = 1;
            const eventDetailMock = stubOne(EventDetail);
            const newHosts = stub(EventProfile);
            const eventMock = stubOne(Event, {
                id: eventIdMock,
                eventDetail: eventDetailMock,
                eventProfiles: newHosts
            });

            validatorStub.validate.resolves(eventMock);

            eventRedisRepositoryStub.getEventLinkSetStatus.resolves(false);

            eventDetailRepositoryStub.findOneByOrFail.resolves(eventDetailMock);

            eventRepositoryStub.update.resolves(updateResultStub);

            serviceSandbox.stub(service, '_linkToProfiles').resolves(true);

            eventDetailRepositoryStub.update.resolves(updateResultStub);

            const updateResult = await service.update(
                teamMock.uuid,
                teamMock.id,
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

    describe('Test Event Removing', () => {

        afterEach(() => {

            eventGroupRepositoryStub.findOneOrFail.reset();

            eventDetailRepositoryStub.delete.reset();
            eventRepositoryStub.delete.reset();
            eventRedisRepositoryStub.remove.reset();
        });

        it('should be removed event', async () => {
            const teamMock = stubOne(Team);

            const hostQuestionStubs = [testMockUtil.getHostQuestionMock()];
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                hostQuestions: hostQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                hostQuestions: eventDetailBodyStub.hostQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
            });
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailStub
            });

            const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

            validatorStub.validate.resolves(eventMock);

            eventDetailRepositoryStub.delete.resolves(deleteResultStub);
            eventRepositoryStub.delete.resolves(deleteResultStub);

            const deleteResult = await service.remove(eventMock.id, teamMock.id);

            expect(deleteResult).true;
            expect(validatorStub.validate.called).true;
            expect(eventRepositoryStub.delete.called).true;
            expect(eventDetailRepositoryStub.delete.called).true;
            expect(eventRedisRepositoryStub.remove.called).true;
        });

        it('should be thrown as an error when an event removal occurs within a transaction', async () => {
            const teamMock = stubOne(Team);

            const hostQuestionStubs = [testMockUtil.getHostQuestionMock()];
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                hostQuestions: hostQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const eventDetailStub = stubOne(EventDetail, {
                hostQuestions: eventDetailBodyStub.hostQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
            });
            const eventMock = stubOne(Event, {
                eventDetail: eventDetailStub
            });

            const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock(0);

            validatorStub.validate.resolves(eventMock);
            eventRepositoryStub.delete.resolves(deleteResultStub);
            eventDetailRepositoryStub.delete.resolves(deleteResultStub);

            await expect(service.remove(eventMock.id, teamMock.id)).rejectedWith(
                InternalServerErrorException
            );

            expect(validatorStub.validate.called).true;
            expect(eventRepositoryStub.delete.called).true;
            expect(eventDetailRepositoryStub.delete.called).true;
            expect(eventRedisRepositoryStub.remove.called).false;
        });

    });

    describe('Test Evetn Cloning', () => {

        afterEach(() => {

            validatorStub.validate.reset();
            utilServiceStub.generateUniqueNumber.reset();

            eventRedisRepositoryStub.clone.reset();
            eventRedisRepositoryStub.setEventLinkSetStatus.reset();
        });

        it('should be cloned event', async () => {
            const teamMock = stubOne(Team);

            const hostQuestionStubs = [testMockUtil.getHostQuestionMock()];
            const notificationInfoStub = testMockUtil.getNotificationInfoMock();

            const eventDetailBodyStub = {
                hostQuestions: hostQuestionStubs,
                notificationInfo: notificationInfoStub
            } as EventsDetailBody;

            const [sourceEventDetailStub, clonedEventDetailStub] = stub(EventDetail, 2, {
                hostQuestions: eventDetailBodyStub.hostQuestions,
                notificationInfo: eventDetailBodyStub.notificationInfo
            });
            const [sourceEventStub, clonedEventStub] = stub(Event, 2);
            sourceEventStub.eventDetail = sourceEventDetailStub;
            clonedEventStub.eventDetail = clonedEventDetailStub;

            validatorStub.validate.resolves(sourceEventStub);
            eventRepositoryStub.save.resolves(clonedEventStub);
            eventRedisRepositoryStub.clone.returns(of(eventDetailBodyStub));

            const clonedEvent = await service.clone(sourceEventDetailStub.id, teamMock.id, teamMock.uuid);
            expect(clonedEvent).ok;

            expect(validatorStub.validate.called).true;
            expect(eventRepositoryStub.save.called).true;
            expect(eventRedisRepositoryStub.clone.called).true;
        });
    });

    describe('Test Linking availability to events', () => {
        afterEach(() => {
            validatorStub.validate.reset();
            eventProfileRepositoryStub.update.reset();
        });

        it('should be linked to availability for event', async () => {
            const teamIdMock = stubOne(Team).id;
            const eventIdMock = stubOne(Event).id;
            const profileIdMock = stubOne(Profile).id;
            const availabilityIdMock = stubOne(Availability).id;

            await service.linkToAvailability(teamIdMock, eventIdMock, profileIdMock, availabilityIdMock);

            expect(validatorStub.validate.called).true;
            expect(eventProfileRepositoryStub.update.called).true;
        });
    });

    describe('Test Linking availability to profiles', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            validatorStub.validate.reset();

            profileRepositoryStub.find.reset();
            eventProfileRepositoryStub.delete.reset();
            eventProfileRepositoryStub.save.reset();

            serviceSandbox.restore();
        });

        it('should be linked to availability for profiles with transaction', async () => {
            const availabilityStub = stubOne(Availability);
            const memberProfileStubs = stub(Profile, 2, {
                availabilities: [availabilityStub]
            });

            const eventProfileMock = stub(EventProfile, 2, {
                availabilityId: undefined,
                profileId: memberProfileStubs[0].id
            });

            const eventProfileStub = stub(EventProfile, 2, {
                availabilityId: availabilityStub.id
            });

            const deleteResultStub = TestMockUtil.getTypeormDeleteResultMock();

            profileRepositoryStub.find.resolves(memberProfileStubs);
            eventProfileRepositoryStub.findBy.resolves(eventProfileStub);

            eventProfileRepositoryStub.delete.resolves(deleteResultStub);
            eventProfileRepositoryStub.save.resolvesArg(0);

            const success = await service._linkToProfiles(
                datasourceMock as unknown as EntityManager,
                eventProfileMock
            );
            expect(success).true;

            expect(profileRepositoryStub.find.called).ok;
            expect(eventProfileRepositoryStub.findBy.called).ok;

            expect(eventProfileRepositoryStub.delete.called).ok;
            expect(eventProfileRepositoryStub.save.called).ok;
        });
    });

    describe('Test Multiple Event Linking / Unlinking with availability', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();

            eventProfileRepositoryStub.update.reset();
        });

        [
            {
                message:
                    'should be linked to availability which is not default and then unlink exclusive events',
                eventIdMocks: stub(Event).map((_event) => _event.id),
                availabilityIdMock: stubOne(Availability).id,
                defaultAvailabilityIdMock: stubOne(Availability).id,
                linkedEventsWithAvailabilityStubs: stub(Event),

                expectedEventProfileRepositoryUpdateCallCount: 2
            },
            {
                message:
                    'should be linked to availability which is default and then no exclusive events',
                eventIdMocks: stub(Event).map((_event) => _event.id),
                availabilityIdMock: 1,
                defaultAvailabilityIdMock: 1,
                linkedEventsWithAvailabilityStubs: stub(Event),

                expectedEventProfileRepositoryUpdateCallCount: 1
            },
            {
                message: 'should be linked to availability which is default and has no any events',
                eventIdMocks: stub(Event).map((_event) => _event.id),
                availabilityIdMock: stubOne(Availability).id,
                defaultAvailabilityIdMock: stubOne(Availability).id,
                linkedEventsWithAvailabilityStubs: [],

                expectedEventProfileRepositoryUpdateCallCount: 1
            }
        ].forEach(function ({
            message,
            eventIdMocks,
            availabilityIdMock,
            defaultAvailabilityIdMock,
            linkedEventsWithAvailabilityStubs,
            expectedEventProfileRepositoryUpdateCallCount
        }) {
            it(message, async () => {
                const teamIdMock = stubOne(Team).id;
                const searchStub = serviceSandbox.stub(service, 'search');
                searchStub.returns(of(linkedEventsWithAvailabilityStubs));

                const exclusiveEventsUpdateResultMock = TestMockUtil.getTypeormUpdateResultMock();
                const eventsUpdateResultMock = TestMockUtil.getTypeormUpdateResultMock();
                const profileIdMock = stubOne(Profile).id;

                eventProfileRepositoryStub.update
                    .onFirstCall()
                    .resolves(exclusiveEventsUpdateResultMock)
                    .onSecondCall()
                    .resolves(eventsUpdateResultMock);

                eventProfileRepositoryStub.update.resolves(eventsUpdateResultMock);

                const result = await service.linksToAvailability(
                    teamIdMock,
                    profileIdMock,
                    eventIdMocks,
                    availabilityIdMock,
                    defaultAvailabilityIdMock
                );

                expect(result).true;
                expect(searchStub.called).true;
                expect(eventProfileRepositoryStub.update.called).true;
                expect(eventProfileRepositoryStub.update.callCount).equals(
                    expectedEventProfileRepositoryUpdateCallCount
                );
            });
        });

        it('should be unlinked from availability then linked to default availability', async () => {
            const availabilityIdMock = stubOne(Availability).id;
            const defaultAvailabilityIdMock = stubOne(Availability).id;

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            eventProfileRepositoryStub.update.resolves(updateResultStub);

            const result = await service.unlinksToAvailability(
                availabilityIdMock,
                defaultAvailabilityIdMock
            );

            expect(result).true;
            expect(eventProfileRepositoryStub.update.called).true;
        });
    });

    describe('Test validations', () => {
        afterEach(() => {
            eventRepositoryStub.find.reset();
        });

        it('should be return true if team has owned events correctly: hasOwnEvents', async () => {
            const teamIdMock = stubOne(Team).id;
            const eventStubs = stub(Event);

            const eventStubIds = eventStubs.map((event) => event.id);

            eventRepositoryStub.find.resolves(
                eventStubs.sort((eventA, eventB) => eventA.id - eventB.id)
            );

            const result = await service.hasOwnEvents(teamIdMock, eventStubIds);

            expect(result).true;
            expect(eventRepositoryStub.find.called).true;
        });

        it('should be return true if team has owned events correctly without sorting status: hasOwnEvents', async () => {
            const teamIdMock = stubOne(Team).id;
            const eventStubs = stub(Event);
            eventStubs[0].id = 5;
            eventStubs[1].id = 1;
            eventStubs[2].id = 3;

            const eventStubIds = eventStubs.map((event) => event.id);

            eventRepositoryStub.find.resolves(
                eventStubs.slice().sort((eventA, eventB) => eventA.id - eventB.id)
            );

            const result = await service.hasOwnEvents(teamIdMock, eventStubIds);

            expect(result).true;
            expect(eventRepositoryStub.find.called).true;
        });

        it('should be return false team has owned events particially, not all: hasOwnEvents', async () => {
            const teamIdMock = stubOne(Team).id;
            const eventStubs = stub(Event);

            const eventStubIds = eventStubs.map((event) => event.id);

            eventRepositoryStub.find.resolves(eventStubs);

            const result = await service.hasOwnEvents(teamIdMock, eventStubIds);

            expect(result).false;
            expect(eventRepositoryStub.find.called).true;
        });

        it('should be return false team has not owned any events: hasOwnEvents', async () => {
            const teamIdMock = stubOne(Team).id;
            const eventIdMocks = stub(Event).map((event) => event.id);

            eventRepositoryStub.find.resolves([]);

            const result = await service.hasOwnEvents(teamIdMock, eventIdMocks);

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
            const teamIdMock = stubOne(Team).id;
            const eventIdMocks = stub(Event).map((event) => event.id);

            serviceSandbox.stub(service, 'hasOwnEvents').resolves(false);

            await expect(service.hasOwnEventsOrThrow(teamIdMock, eventIdMocks)).rejectedWith(
                NotAnOwnerException
            );
        });

        it('should be not thrown error if hasOwnEvents returns true: hasOwnEventsOrThrow', async () => {
            const teamIdMock = stubOne(Team).id;
            const eventIdMocks = stub(Event).map((event) => event.id);

            serviceSandbox.stub(service, 'hasOwnEvents').resolves(true);

            await expect(service.hasOwnEventsOrThrow(teamIdMock, eventIdMocks)).fulfilled;
        });
    });
});
