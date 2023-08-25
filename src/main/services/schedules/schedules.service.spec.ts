import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { Weekday } from '@interfaces/availability/weekday.enum';
import { AvailableTime } from '@interfaces/availability/available-time';
import { ScheduledEventSearchOption } from '@interfaces/schedules/scheduled-event-search-option.interface';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledBufferTime } from '@entity/schedules/scheduled-buffer-time.entity';
import { ScheduledTimeset } from '@entity/schedules/scheduled-timeset.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { SchedulesService } from './schedules.service';

const testMockUtil = new TestMockUtil();

describe.skip('SchedulesService', () => {
    let service: SchedulesService;

    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;

    let googleCalendarIntegrationsServiceStub: sinon.SinonStubbedInstance<GoogleCalendarIntegrationsService>;
    let schedulesRedisRepositoryStub: sinon.SinonStubbedInstance<SchedulesRedisRepository>;
    let availabilityRedisRepositoryStub: sinon.SinonStubbedInstance<AvailabilityRedisRepository>;
    let scheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<Schedule>>;
    let googleIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegrationSchedule>>;
    let loggerStub: sinon.SinonStubbedInstance<Logger>;

    const _1Hour = 60 * 60 * 1000;

    before(async () => {

        utilServiceStub = sinon.createStubInstance(UtilService);
        eventsServiceStub = sinon.createStubInstance(EventsService);

        googleCalendarIntegrationsServiceStub = sinon.createStubInstance(GoogleCalendarIntegrationsService);
        schedulesRedisRepositoryStub = sinon.createStubInstance(SchedulesRedisRepository);
        availabilityRedisRepositoryStub = sinon.createStubInstance(AvailabilityRedisRepository);
        scheduleRepositoryStub = sinon.createStubInstance<Repository<Schedule>>(Repository);
        googleIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegrationSchedule>>(
            Repository
        );
        loggerStub = sinon.createStubInstance(Logger);

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
                    provide: GoogleCalendarIntegrationsService,
                    useValue: googleCalendarIntegrationsServiceStub
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
                },
                {
                    provide: getRepositoryToken(GoogleIntegrationSchedule),
                    useValue: googleIntegrationScheduleRepositoryStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                }
            ]
        }).compile();

        service = module.get<SchedulesService>(SchedulesService);
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
            googleCalendarIntegrationsServiceStub.findOne.reset();
            googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.reset();
            googleCalendarIntegrationsServiceStub.patchGoogleCalendarEvent.reset();
            schedulesRedisRepositoryStub.save.reset();
            scheduleRepositoryStub.save.reset();
            scheduleRepositoryStub.findBy.reset();
            scheduleRepositoryStub.findOneBy.reset();
            scheduleRepositoryStub.findOneByOrFail.reset();
            scheduleRepositoryStub.update.reset();
            googleIntegrationScheduleRepositoryStub.findOneBy.reset();

            serviceSandbox.restore();
        });

        describe('Test scheduled events', () => {

            const hostUUIDMock = stubOne(User).uuid;
            const eventUUIDMock = stubOne(Event).uuid;
            const scheduleStubs = stub(Schedule);

            afterEach(() => {
                scheduleRepositoryStub.findBy.reset();
                googleIntegrationScheduleRepositoryStub.findBy.reset();
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
                    } as ScheduledEventSearchOption,
                    expectedStartBufferTimestampSetting: true,
                    expectedEndBufferTimestampSetting: true
                }
            ].forEach(function({
                description,
                searchOption
            }) {

                it(description, async () => {

                    const googleIntegartionScheduleStubs = stub(GoogleIntegrationSchedule);

                    scheduleRepositoryStub.findBy.resolves(scheduleStubs);
                    googleIntegrationScheduleRepositoryStub.findBy.resolves(googleIntegartionScheduleStubs);

                    const searchedSchedules = await firstValueFrom(
                        service.search(searchOption)
                    );

                    expect(searchedSchedules).ok;
                    expect(searchedSchedules.length).greaterThan(0);
                    expect(scheduleRepositoryStub.findBy.called).true;

                    const actualComposedScheduledEventSearchOptions = scheduleRepositoryStub.findBy.getCall(0).args[0] as Array<FindOptionsWhere<Schedule>>;
                    const actualComposedGoogleScheduledEventSearchOptions = googleIntegrationScheduleRepositoryStub.findBy.getCall(0).args[0] as Array<FindOptionsWhere<Schedule>>;

                    expect((actualComposedScheduledEventSearchOptions[0].scheduledTime as ScheduledTimeset).startTimestamp).ok;
                    expect((actualComposedScheduledEventSearchOptions[0].scheduledTime as ScheduledTimeset).endTimestamp).ok;
                    expect((actualComposedScheduledEventSearchOptions[1].scheduledBufferTime as ScheduledBufferTime).startBufferTimestamp).ok;
                    expect((actualComposedScheduledEventSearchOptions[1].scheduledBufferTime as ScheduledBufferTime).endBufferTimestamp).ok;

                    expect((actualComposedGoogleScheduledEventSearchOptions[0].scheduledTime as ScheduledTimeset).startTimestamp).ok;
                    expect((actualComposedGoogleScheduledEventSearchOptions[0].scheduledTime as ScheduledTimeset).endTimestamp).ok;
                    expect((actualComposedGoogleScheduledEventSearchOptions[1].scheduledBufferTime as ScheduledBufferTime).startBufferTimestamp).ok;
                    expect((actualComposedGoogleScheduledEventSearchOptions[1].scheduledBufferTime as ScheduledBufferTime).endBufferTimestamp).ok;
                });
            });

        });


        it('should be fetched scheduled event one', async () => {

            const scheduleStub = stubOne(Schedule);
            const scheduleBodyStub = testMockUtil.getScheduleBodyMock();

            scheduleRepositoryStub.findOneByOrFail.resolves(scheduleStub);
            schedulesRedisRepositoryStub.getScheduleBody.returns(of(scheduleBodyStub));

            const fetchedScheduledEvent = await firstValueFrom(
                service.findOne(scheduleStub.uuid)
            );

            expect(fetchedScheduledEvent).ok;
            expect(scheduleRepositoryStub.findOneByOrFail.called).true;
        });

        it('should be created scheduled event if google calendar is integrated and google meet link exist', async () => {

            const userSettingStub = stubOne(UserSetting);
            const userMock = stubOne(User, {
                userSetting: userSettingStub
            });
            const availabilityMock = stubOne(Availability);
            const eventStub = stubOne(Event, {
                availability: availabilityMock
            });
            const scheduleStub = stubOne(Schedule);
            const googleCalendarIntegrationStub = stubOne(GoogleCalendarIntegration);
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock();

            eventsServiceStub.findOneByUserWorkspaceAndUUID.resolves(eventStub);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);
            googleCalendarIntegrationsServiceStub.findOne.returns(of(googleCalendarIntegrationStub));
            googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.resolves(googleScheduleMock);
            googleCalendarIntegrationsServiceStub.patchGoogleCalendarEvent.resolves(googleScheduleMock);

            const validateStub = serviceSandbox.stub(service, 'validate').returns(of(scheduleStub));
            const isOutboundScheduleStub = serviceSandbox.stub(service, 'hasScheduleLink').returns(true);

            scheduleRepositoryStub.save.resolves(scheduleStub);
            schedulesRedisRepositoryStub.save.returns(of(scheduleStub));

            availabilityRedisRepositoryStub.getAvailabilityBody.resolves(availabilityBodyMock);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);

            const createdSchedule = await firstValueFrom(
                service._create(
                    {
                        getRepository: () => scheduleRepositoryStub
                    } as unknown as any,
                    userMock.workspace as string,
                    eventStub.uuid,
                    scheduleStub,
                    userMock
                )
            );

            expect(createdSchedule).ok;
            expect(eventsServiceStub.findOneByUserWorkspaceAndUUID.called).true;
            expect(availabilityRedisRepositoryStub.getAvailabilityBody.called).true;
            expect(utilServiceStub.getPatchedScheduledEvent.called).true;
            expect(googleCalendarIntegrationsServiceStub.findOne.called).true;
            expect(googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.called).true;
            expect(googleCalendarIntegrationsServiceStub.patchGoogleCalendarEvent.called).true;
            expect(validateStub.called).true;
            expect(isOutboundScheduleStub.called).true;
            expect(scheduleRepositoryStub.save.called).true;
            expect(schedulesRedisRepositoryStub.save.called).true;
        });

        it('should be created scheduled event if google calendar is integrated and google meet link does not exist', async () => {

            const userSettingStub = stubOne(UserSetting);
            const userMock = stubOne(User, {
                userSetting: userSettingStub
            });
            const availabilityMock = stubOne(Availability);
            const eventStub = stubOne(Event, {
                availability: availabilityMock
            });
            const scheduleStub = stubOne(Schedule);
            const googleCalendarIntegrationStub = stubOne(GoogleCalendarIntegration);
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock();

            eventsServiceStub.findOneByUserWorkspaceAndUUID.resolves(eventStub);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);
            googleCalendarIntegrationsServiceStub.findOne.returns(of(googleCalendarIntegrationStub));
            googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.resolves(googleScheduleMock);

            const validateStub = serviceSandbox.stub(service, 'validate').returns(of(scheduleStub));
            const isOutboundScheduleStub = serviceSandbox.stub(service, 'hasScheduleLink').returns(false);

            scheduleRepositoryStub.save.resolves(scheduleStub);
            schedulesRedisRepositoryStub.save.returns(of(scheduleStub));

            availabilityRedisRepositoryStub.getAvailabilityBody.resolves(availabilityBodyMock);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);

            const createdSchedule = await firstValueFrom(
                service._create(
                    {
                        getRepository: () => scheduleRepositoryStub
                    } as unknown as any,
                    userMock.workspace as string,
                    eventStub.uuid,
                    scheduleStub,
                    userMock
                )
            );

            expect(createdSchedule).ok;
            expect(eventsServiceStub.findOneByUserWorkspaceAndUUID.called).true;
            expect(availabilityRedisRepositoryStub.getAvailabilityBody.called).true;
            expect(utilServiceStub.getPatchedScheduledEvent.called).true;
            expect(googleCalendarIntegrationsServiceStub.findOne.called).true;
            expect(googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.called).true;
            expect(googleCalendarIntegrationsServiceStub.patchGoogleCalendarEvent.called).false;
            expect(validateStub.called).true;
            expect(isOutboundScheduleStub.called).true;
            expect(scheduleRepositoryStub.save.called).true;
            expect(schedulesRedisRepositoryStub.save.called).true;
        });

        it('should be created scheduled event even if google calendar is not integrated', async () => {

            const userSettingStub = stubOne(UserSetting);
            const userMock = stubOne(User, {
                userSetting: userSettingStub
            });
            const availabilityMock = stubOne(Availability);
            const eventStub = stubOne(Event, {
                availability: availabilityMock
            });
            const scheduleStub = stubOne(Schedule);
            const googleCalendarIntegrationStub = null;
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();

            eventsServiceStub.findOneByUserWorkspaceAndUUID.resolves(eventStub);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);
            googleCalendarIntegrationsServiceStub.findOne.returns(of(googleCalendarIntegrationStub));

            const validateStub = serviceSandbox.stub(service, 'validate').returns(of(scheduleStub));

            scheduleRepositoryStub.save.resolves(scheduleStub);
            schedulesRedisRepositoryStub.save.returns(of(scheduleStub));

            availabilityRedisRepositoryStub.getAvailabilityBody.resolves(availabilityBodyMock);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);

            const createdSchedule = await firstValueFrom(
                service._create(
                    {
                        getRepository: () => scheduleRepositoryStub
                    } as unknown as any,
                    userMock.workspace as string,
                    eventStub.uuid,
                    scheduleStub,
                    userMock
                )
            );

            expect(createdSchedule).ok;
            expect(eventsServiceStub.findOneByUserWorkspaceAndUUID.called).true;
            expect(googleCalendarIntegrationsServiceStub.findOne.called).true;
            expect(availabilityRedisRepositoryStub.getAvailabilityBody.called).true;
            expect(utilServiceStub.getPatchedScheduledEvent.called).true;
            expect(googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.called).false;
            expect(googleCalendarIntegrationsServiceStub.patchGoogleCalendarEvent.called).false;
            expect(validateStub.called).true;
            expect(scheduleRepositoryStub.save.called).true;
            expect(schedulesRedisRepositoryStub.save.called).true;
        });

        it('should be updated scheduled event', async () => {

            const scheduleStub = stubOne(Schedule);

            const updateResultMock = TestMockUtil.getTypeormUpdateResultMock();
            scheduleRepositoryStub.update.resolves(updateResultMock);

            const scheduleUpdateResult = await firstValueFrom(
                service._update(
                    {
                        getRepository: () => scheduleRepositoryStub
                    } as unknown as any,
                    scheduleStub.id,
                    {
                        color: '#000000'
                    }
                )
            );

            expect(scheduleRepositoryStub.update.called).true;
            expect(scheduleUpdateResult).true;

        });

        it('should be returned false for no location schedule', () => {

            const noLocationScheduleStub = stubOne(Schedule);

            delete (noLocationScheduleStub as any)['contacts'];

            const result = service.hasScheduleLink(noLocationScheduleStub);

            expect(result).false;
        });

        it('should be returned true for link type schedule', () => {

            const noLocationScheduleStub = stubOne(Schedule, {
                contacts: [
                    {
                        type: ContactType.GOOGLE_MEET,
                        value: 'linklink'
                    }
                ]
            });

            const result = service.hasScheduleLink(noLocationScheduleStub);

            expect(result).true;
        });
    });

    describe('Test for Validation in Creating a Schedule', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            eventsServiceStub.findOneByUserWorkspaceAndUUID.reset();
            utilServiceStub.getPatchedScheduledEvent.reset();
            utilServiceStub.localizeDateTime.reset();
            googleCalendarIntegrationsServiceStub.findOne.reset();
            googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.reset();
            googleCalendarIntegrationsServiceStub.patchGoogleCalendarEvent.reset();
            schedulesRedisRepositoryStub.save.reset();
            scheduleRepositoryStub.save.reset();
            scheduleRepositoryStub.findBy.reset();
            scheduleRepositoryStub.findOneBy.reset();
            scheduleRepositoryStub.findOneByOrFail.reset();
            scheduleRepositoryStub.update.reset();
            googleIntegrationScheduleRepositoryStub.findOneBy.reset();

            serviceSandbox.restore();
        });

        describe('Test to validate a pass', () => {
            [
                {
                    description: 'should be passed if the schedule has no conflicts for all conditions',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleMock: stubOne(Schedule, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    googleIntegrationScheduleStub: null
                },
                {
                    description: 'should be passed if the schedule is not within the event availability but is within the override availability time',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleMock: stubOne(Schedule, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: false,
                    conflictedScheduleStub: null,
                    googleIntegrationScheduleStub: null
                },
                {
                    description: 'should be passed if the schedule is within the event availability but is not within the override availability time',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleMock: stubOne(Schedule, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithOverridesStubValue: false,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    googleIntegrationScheduleStub: null
                }
            ].forEach(function ({
                description,
                timezoneMock,
                scheduleMock,
                availabilityBodyMock,
                _isPastTimestampStubValue,
                _isTimeOverlappingWithOverridesStubValue,
                _isTimeOverlappingWithAvailableTimesStubValue,
                conflictedScheduleStub,
                googleIntegrationScheduleStub
            }) {
                it(description, async () => {
                    const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(_isPastTimestampStubValue);
                    const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isInvalidTimeOverlappingWithOverrides').returns(_isTimeOverlappingWithOverridesStubValue);
                    const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(_isTimeOverlappingWithAvailableTimesStubValue);

                    scheduleRepositoryStub.findOneBy.resolves(conflictedScheduleStub);
                    googleIntegrationScheduleRepositoryStub.findOneBy.resolves(googleIntegrationScheduleStub);

                    const validatedSchedule = await firstValueFrom(
                        service.validate(
                            scheduleMock,
                            timezoneMock,
                            availabilityBodyMock
                        )
                    );

                    expect(validatedSchedule).ok;
                    expect(scheduleRepositoryStub.findOneBy.called).true;
                    expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;

                    expect(_isPastTimestampStub.called).true;
                    expect(_isTimeOverlappingWithOverridesStub.called).true;
                    expect(_isTimeOverlappingWithAvailableTimesStub.called).true;
                });
            });
        });

        describe('Test to Validation Does Not Pass With Conflict', () => {
            [
                {
                    description: 'should not be passed if the ensured schedule start time or ensured end time is earlier than now',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleTimeMock: testMockUtil.getScheduleTimeMock(new Date(Date.now() - _1Hour)),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: true,
                    _isTimeOverlappingWithOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    googleIntegrationScheduleStub: null
                },
                {
                    description: 'should not be passed if the ensured schedule start time is earlier than the ensured end time: scheduledTime',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleTimeMock: {
                        scheduledBufferTime : {
                            startBufferTimestamp: null,
                            endBufferTimestamp: null
                        } as ScheduledBufferTime,
                        scheduledTime: {
                            startTimestamp: new Date(),
                            endTimestamp: new Date(Date.now() - _1Hour)
                        } as ScheduledTimeset
                    },
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    googleIntegrationScheduleStub: null
                },
                {
                    description: 'should not be passed if the ensured schedule start time is earlier than the ensured end time: scheduledBufferTime',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleTimeMock: {
                        scheduledBufferTime : {
                            startBufferTimestamp: null,
                            endBufferTimestamp: new Date(Date.now() - _1Hour)
                        } as ScheduledBufferTime,
                        scheduledTime: {
                            startTimestamp: new Date(Date.now() + _1Hour),
                            endTimestamp: new Date(Date.now() + 2 * _1Hour)
                        } as ScheduledTimeset
                    },
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    googleIntegrationScheduleStub: null
                },
                {
                    description: 'should not be passed if the schedule is not within the availability of the event to be scheduled and is also not within the override availability time',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleTimeMock: testMockUtil.getScheduleTimeMock(),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithOverridesStubValue: false,
                    _isTimeOverlappingWithAvailableTimesStubValue: false,
                    conflictedScheduleStub: null,
                    googleIntegrationScheduleStub: null
                }
            ].forEach(function ({
                description,
                timezoneMock,
                scheduleTimeMock,
                availabilityBodyMock,
                _isPastTimestampStubValue,
                _isTimeOverlappingWithOverridesStubValue,
                _isTimeOverlappingWithAvailableTimesStubValue,
                conflictedScheduleStub,
                googleIntegrationScheduleStub
            }) {
                it(description, () => {
                    const scheduleMock = stubOne(Schedule, scheduleTimeMock);

                    const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(_isPastTimestampStubValue);
                    const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isInvalidTimeOverlappingWithOverrides').returns(_isTimeOverlappingWithOverridesStubValue);
                    const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(_isTimeOverlappingWithAvailableTimesStubValue);

                    scheduleRepositoryStub.findOneBy.resolves(conflictedScheduleStub);
                    googleIntegrationScheduleRepositoryStub.findOneBy.resolves(googleIntegrationScheduleStub);

                    expect(() => service.validate(scheduleMock, timezoneMock, availabilityBodyMock)).throws(CannotCreateByInvalidTimeRange);

                    expect(scheduleRepositoryStub.findOneBy.called).false;
                    expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;

                    expect(_isPastTimestampStub.called).true;
                    expect(_isTimeOverlappingWithOverridesStub.called).true;
                    expect(_isTimeOverlappingWithAvailableTimesStub.called).true;
                });
            });
        });

        describe('Test to Validation Does Not Pass if a Schedule Already Exists or if a Schedule Exists Google Integration', () => {
            [
                {
                    description: 'should not be passed if the schedule overlaps with an existing schedule',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleMock: stubOne(Schedule, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: stubOne(Schedule),
                    googleCalendarIntegrationMock: null
                },
                {
                    description: 'should not be passed if the schedule overlaps with a Google-integrated schedule',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleMock: stubOne(Schedule, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    googleCalendarIntegrationMock: stubOne(GoogleCalendarIntegration)
                }
            ].forEach(function ({
                description,
                timezoneMock,
                scheduleMock,
                availabilityBodyMock,
                _isPastTimestampStubValue,
                _isTimeOverlappingWithOverridesStubValue,
                _isTimeOverlappingWithAvailableTimesStubValue,
                conflictedScheduleStub,
                googleCalendarIntegrationMock
            }) {
                it(description, async () => {
                    const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(_isPastTimestampStubValue);
                    const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isInvalidTimeOverlappingWithOverrides').returns(_isTimeOverlappingWithOverridesStubValue);
                    const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(_isTimeOverlappingWithAvailableTimesStubValue);

                    const googleIntegrationScheduleStub = stubOne(GoogleIntegrationSchedule, {
                        googleCalendarIntegration: googleCalendarIntegrationMock ?? undefined,
                        googleCalendarIntegrationId: googleCalendarIntegrationMock?.id
                    });

                    scheduleRepositoryStub.findOneBy.resolves(conflictedScheduleStub);
                    googleIntegrationScheduleRepositoryStub.findOneBy.resolves(googleIntegrationScheduleStub);

                    await expect(firstValueFrom(
                        service.validate(
                            scheduleMock,
                            timezoneMock,
                            availabilityBodyMock,
                            googleCalendarIntegrationMock?.id
                        )
                    )
                    ).rejectedWith(CannotCreateByInvalidTimeRange);

                    expect(scheduleRepositoryStub.findOneBy.called).true;

                    if (conflictedScheduleStub){
                        expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;
                    } else {
                        expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).true;
                    }

                    expect(_isPastTimestampStub.called).true;
                    expect(_isTimeOverlappingWithOverridesStub.called).true;
                    expect(_isTimeOverlappingWithAvailableTimesStub.called).true;
                });
            });
        });
    });

    it('should be fetched TypeORM Condition options for google calendar integraion', () => {

        const testDateTimestamp = new Date('2023-08-16T08:00:00.000Z');

        const googleCalendarIntegrationId = 1;

        const startDateTimeMock = new Date(testDateTimestamp);
        const endDateTimeMock = new Date(testDateTimestamp);

        const typeormConditionOptions = service._getScheduleConflictCheckOptions(
            startDateTimeMock,
            endDateTimeMock,
            { googleCalendarIntegrationId }
        );

        expect(typeormConditionOptions).ok;
        expect(typeormConditionOptions.length).greaterThan(0);
        expect(typeormConditionOptions[0]).ok;
    });

    describe('Test for ensured schedule start time and end time compare with now test', () => {
        [
            {
                description: 'should be returned true if the ensured schedule start time is earlier than now',
                startDateTimestampMock: Date.now() - _1Hour,
                ensuredEndDateTimestampMock: Date.now() + _1Hour,
                expectedResult: true
            },
            {
                description: 'should be returned true if the ensured schedule end time is earlier than now',
                startDateTimestampMock: Date.now() + _1Hour,
                ensuredEndDateTimestampMock: Date.now() - _1Hour,
                expectedResult: true
            },
            {
                description: 'should be returned false if both the ensured schedule start time and end time are later than now',
                startDateTimestampMock: Date.now() + _1Hour,
                ensuredEndDateTimestampMock: Date.now() + 2 * _1Hour,
                expectedResult: false
            }
        ].forEach(function ({
            description,
            startDateTimestampMock,
            ensuredEndDateTimestampMock,
            expectedResult
        }) {
            it(description, () => {
                const result = service._isPastTimestamp(startDateTimestampMock, ensuredEndDateTimestampMock);

                expect(result).equal(expectedResult);

            });
        });
    });

    describe('Test for verifying the overlap between ensured start and end date timestamp and overrided availability time test', () => {

        const timezoneMock = 'Asia/Seoul';

        afterEach(() => {
            utilServiceStub.localizeDateTime.reset();
        });

        // expected result true means request schedule data is invalid.
        [
            {
                description: 'should be returned false if there is no overrided availability time',
                timezoneMock,
                overridesMock: [],
                startDateTimestampMock: Date.now(),
                endDateTimestampMock: Date.now(),
                expectedResult: false
            },
            {
                description: 'should be returned false if there is overrided availability but they have no time range without overlapping',
                timezoneMock,
                overridesMock: [
                    {
                        targetDate: new Date('2023-08-25T00:00:00'),
                        timeRanges: []
                    }
                ],
                startDateTimestampMock: new Date('2023-08-24T00:00:01').getTime(),
                endDateTimestampMock: new Date('2023-08-24T01:00:01').getTime(),
                expectedResult: false
            },
            {
                description: 'should be returned true if there is overrided availability but they have no time range with overlapping',
                timezoneMock,
                overridesMock: [
                    {
                        targetDate: new Date('2023-08-25T00:00:00'),
                        timeRanges: []
                    }
                ],
                startDateTimestampMock: new Date('2023-08-24T00:00:01').getTime(),
                endDateTimestampMock: new Date('2023-08-25T00:10:00').getTime(),
                expectedResult: true
            },
            {
                description: 'should be returned false if there are overrided availability time, and the ensured start time and end time both are included in the available time in override',
                timezoneMock,
                overridesMock: [
                    {
                        targetDate: new Date('2023-08-25T00:00:00'),
                        timeRanges: [
                            {
                                startTime: '09:00:00',
                                endTime: '11:00:00'
                            } as TimeRange
                        ]
                    } as OverridedAvailabilityTime
                ],
                startDateTimestampMock: new Date('2023-08-25T09:00:00').getTime(),
                endDateTimestampMock: new Date('2023-08-25T10:00:00').getTime(),
                expectedResult: false
            },
            {
                description: 'should be returned true if there are overrided availability time, and the ensured start time and end time both are included in the available time in override',
                timezoneMock,
                overridesMock: [
                    {
                        targetDate: new Date('2023-08-25T00:00:00'),
                        timeRanges: [
                            {
                                startTime: '09:00:00',
                                endTime: '11:00:00'
                            } as TimeRange
                        ]
                    } as OverridedAvailabilityTime
                ],
                startDateTimestampMock: new Date('2023-08-25T08:00:00').getTime(),
                endDateTimestampMock: new Date('2023-08-25T09:00:00').getTime(),
                expectedResult: true
            }
        ].forEach(function ({
            description,
            timezoneMock,
            overridesMock,
            startDateTimestampMock,
            endDateTimestampMock,
            expectedResult
        }) {
            it(description, () => {

                overridesMock.forEach((overridedAvailabilityTimeMock) => {
                    overridedAvailabilityTimeMock.timeRanges.forEach((timeRangeMock) => {
                        const startDateTimeStub = new Date(timeRangeMock.startTime);
                        const endDateTimeStub = new Date(timeRangeMock.endTime);

                        utilServiceStub.localizeDateTime.onFirstCall().returns(startDateTimeStub);
                        utilServiceStub.localizeDateTime.onSecondCall().returns(endDateTimeStub);
                    });
                });

                const isTimeOverlappedWithOverrides = service._isInvalidTimeOverlappingWithOverrides(
                    timezoneMock,
                    overridesMock,
                    startDateTimestampMock,
                    endDateTimestampMock
                );

                if (overridesMock.length > 0) {
                    expect(utilServiceStub.localizeDateTime.callCount).to.be.at.least(2);
                } else {
                    expect(utilServiceStub.localizeDateTime.called).false;
                }
                expect(isTimeOverlappedWithOverrides).equal(expectedResult);
            });
        });
    });

    describe('Test for verifying the overlap between ensured start and end date timestamp and available times', () => {
        let serviceSandbox: sinon.SinonSandbox;

        const testUTCDate = new Date('2023-08-16T08:00:00.000Z');
        const testDateTimestamp = testUTCDate.getTime();

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            utilServiceStub.dateToTimeString.reset();
            utilServiceStub.localizeDateTime.reset();
            serviceSandbox.restore();
        });

        [
            {
                description: 'should be returned false if there is no availability time',
                availableTimesMock: [],
                availabilityTimezoneDummy: stubOne(Availability).timezone,
                startDateTimeMock: new Date(testDateTimestamp - _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + _1Hour),
                isTimeOverlappingWithStartDateTimeStub: true,
                isTimeOverlappingWithEndDateTimeStub: true,
                expectedResult: false
            },
            {
                description: 'should be returned false if there are availability times, and both the ensured start time and end time are not included in any availability time',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: testDateTimestamp - 3 * _1Hour,
                                endTime: testDateTimestamp - 2 * _1Hour
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezoneDummy: stubOne(Availability).timezone,
                startDateTimeMock: new Date(testDateTimestamp - _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + _1Hour),
                isTimeOverlappingWithStartDateTimeStub: false,
                isTimeOverlappingWithEndDateTimeStub: false,
                expectedResult: false
            },
            {
                description: 'should be returned false if there are availability times, and the ensured start time is included in any availability time, but end time is not',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: testDateTimestamp - 3 * _1Hour,
                                endTime: testDateTimestamp + 2 * _1Hour
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezoneDummy: stubOne(Availability).timezone,
                startDateTimeMock: new Date(testDateTimestamp - _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + 3 * _1Hour),
                isTimeOverlappingWithStartDateTimeStub: true,
                isTimeOverlappingWithEndDateTimeStub: false,
                expectedResult: false
            },
            {
                description: 'should be returned false if there are availability times, and the ensured end time is included in any availability time, but start time is not',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: testDateTimestamp - 3 * _1Hour,
                                endTime: testDateTimestamp + 2 * _1Hour
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezoneDummy: stubOne(Availability).timezone,
                startDateTimeMock: new Date(testDateTimestamp - 4 * _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + _1Hour),
                isTimeOverlappingWithStartDateTimeStub: false,
                isTimeOverlappingWithEndDateTimeStub: true,
                expectedResult: false
            },
            {
                description: 'should be returned true if there are availability times, and at least one of the ensured start time and end time is included in the availability time',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: testDateTimestamp - 2 * _1Hour,
                                endTime: testDateTimestamp + 2 * _1Hour
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezoneDummy: stubOne(Availability).timezone,
                startDateTimeMock: new Date(testDateTimestamp - _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + _1Hour),
                isTimeOverlappingWithStartDateTimeStub: true,
                isTimeOverlappingWithEndDateTimeStub: true,
                expectedResult: true
            }

        ].forEach(function ({
            description,
            availableTimesMock,
            availabilityTimezoneDummy,
            startDateTimeMock,
            endDateTimeMock,
            isTimeOverlappingWithStartDateTimeStub,
            isTimeOverlappingWithEndDateTimeStub,
            expectedResult
        }) {
            it(description, () => {
                utilServiceStub.dateToTimeString.onFirstCall().returns('startTimeStringStub');
                utilServiceStub.dateToTimeString.onSecondCall().returns('endTimeStringStub');

                utilServiceStub.localizeDateTime.onFirstCall().returns(startDateTimeMock);
                utilServiceStub.localizeDateTime.onSecondCall().returns(endDateTimeMock);

                const startWeekdayAvailableTimeStub = availableTimesMock.find((_availableTimeMock) => _availableTimeMock.day === startDateTimeMock.getDay());
                const endWeekdayAvailableTimeStub = availableTimesMock.find((_availableTimeMock) => _availableTimeMock.day === endDateTimeMock.getDay());

                const _isTimeOverlappingWithAvailableTimeRangeStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimeRange')
                    .onFirstCall().returns(isTimeOverlappingWithStartDateTimeStub)
                    .onSecondCall().returns(isTimeOverlappingWithEndDateTimeStub);

                const isTimeOverlapping = service._isTimeOverlappingWithAvailableTimes(availableTimesMock, availabilityTimezoneDummy, startDateTimeMock, endDateTimeMock);

                if (startWeekdayAvailableTimeStub && endWeekdayAvailableTimeStub) {
                    expect(_isTimeOverlappingWithAvailableTimeRangeStub.calledTwice).true;
                } else {
                    expect(_isTimeOverlappingWithAvailableTimeRangeStub.called).false;
                }

                expect(utilServiceStub.dateToTimeString.calledTwice).true;
                expect(utilServiceStub.localizeDateTime.calledTwice).true;
                expect(isTimeOverlapping).equal(expectedResult);
            });
        });
    });

    it('should be returned true for time calculation with inclusively', () => {
        const date = new Date('2023-07-21T13:00:00.000Z');
        const timezone = 'America/New_York';

        const overridedAvailabilityTimeMock = testMockUtil.getOverridedAvailabilityTimeMock();
        const timeRangesMock = overridedAvailabilityTimeMock.timeRanges;

        const localizedDateStub = new Date('2023-07-21T13:00:00.000Z');
        utilServiceStub.localizeDateTime.returns(localizedDateStub);

        const result = service._isTimeOverlappingWithAvailableTimeRange(date, timezone, timeRangesMock);

        expect(result).true;
        expect(utilServiceStub.localizeDateTime.called).true;
    });

});
