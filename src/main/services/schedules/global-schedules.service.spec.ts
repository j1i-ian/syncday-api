import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Weekday } from '@interfaces/availability/weekday.enum';
import { AvailableTime } from '@interfaces/availability/available-time';
import { ScheduledEventSearchOption } from '@interfaces/schedules/scheduled-event-search-option.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { NativeSchedulesService } from '@services/schedules/native-schedules.service';
import { GoogleIntegrationSchedulesService } from '@services/integrations/google-integration/google-integration-schedules/google-integration-schedules.service';
import { AppleIntegrationsSchedulesService } from '@services/integrations/apple-integrations/apple-integrations-schedules/apple-integrations-schedules.service';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { GoogleConferenceLinkIntegrationService } from '@services/integrations/google-integration/google-conference-link-integration/google-conference-link-integration.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { GoogleIntegrationSchedule } from '@entity/integrations/google/google-integration-schedule.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledBufferTime } from '@entity/schedules/scheduled-buffer-time.entity';
import { ScheduledTimeset } from '@entity/schedules/scheduled-timeset.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { GlobalSchedulesService } from './global-schedules.service';

const testMockUtil = new TestMockUtil();

describe('SchedulesService', () => {
    let service: GlobalSchedulesService;

    let integrationsServiceLocatorStub: sinon.SinonStubbedInstance<IntegrationsServiceLocator>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let timeUtilServiceStub: sinon.SinonStubbedInstance<TimeUtilService>;

    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let nativeSchedulesServiceStub: sinon.SinonStubbedInstance<NativeSchedulesService>;
    let calendarIntegrationsServiceLocatorStub: sinon.SinonStubbedInstance<CalendarIntegrationsServiceLocator>;

    let googleCalendarIntegrationsServiceStub: sinon.SinonStubbedInstance<GoogleCalendarIntegrationsService>;
    let schedulesRedisRepositoryStub: sinon.SinonStubbedInstance<SchedulesRedisRepository>;
    let availabilityRedisRepositoryStub: sinon.SinonStubbedInstance<AvailabilityRedisRepository>;
    let scheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<Schedule>>;
    let googleIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegrationSchedule>>;
    let appleCalDAVIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVIntegrationSchedule>>;

    let googleIntegrationSchedulesServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationSchedulesService>;
    let appleIntegrationsSchedulesServiceStub: sinon.SinonStubbedInstance<AppleIntegrationsSchedulesService>;
    const _1Hour = 60 * 60 * 1000;

    let googleConferenceLinkIntegrationServiceStub: sinon.SinonStubbedInstance<GoogleConferenceLinkIntegrationService>;

    before(async () => {

        integrationsServiceLocatorStub = sinon.createStubInstance(IntegrationsServiceLocator);
        utilServiceStub = sinon.createStubInstance(UtilService);
        timeUtilServiceStub = sinon.createStubInstance(TimeUtilService);

        eventsServiceStub = sinon.createStubInstance(EventsService);
        nativeSchedulesServiceStub = sinon.createStubInstance(NativeSchedulesService);
        calendarIntegrationsServiceLocatorStub = sinon.createStubInstance(CalendarIntegrationsServiceLocator);

        googleCalendarIntegrationsServiceStub = sinon.createStubInstance(GoogleCalendarIntegrationsService);
        schedulesRedisRepositoryStub = sinon.createStubInstance(SchedulesRedisRepository);
        availabilityRedisRepositoryStub = sinon.createStubInstance(AvailabilityRedisRepository);
        scheduleRepositoryStub = sinon.createStubInstance<Repository<Schedule>>(Repository);
        googleIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegrationSchedule>>(
            Repository
        );
        appleCalDAVIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVIntegrationSchedule>>(
            Repository
        );

        googleIntegrationSchedulesServiceStub = sinon.createStubInstance(GoogleIntegrationSchedulesService);
        appleIntegrationsSchedulesServiceStub = sinon.createStubInstance(AppleIntegrationsSchedulesService);
        integrationsServiceLocatorStub.getAllIntegrationSchedulesService.returns([
            googleIntegrationSchedulesServiceStub,
            appleIntegrationsSchedulesServiceStub
        ]);

        googleConferenceLinkIntegrationServiceStub = sinon.createStubInstance(GoogleConferenceLinkIntegrationService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GlobalSchedulesService,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: TimeUtilService,
                    useValue: timeUtilServiceStub
                },
                {
                    provide: EventsService,
                    useValue: eventsServiceStub
                },
                {
                    provide: NativeSchedulesService,
                    useValue: nativeSchedulesServiceStub
                },
                {
                    provide: CalendarIntegrationsServiceLocator,
                    useValue: calendarIntegrationsServiceLocatorStub
                },
                {
                    provide: GoogleCalendarIntegrationsService,
                    useValue: googleCalendarIntegrationsServiceStub
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
                },
                {
                    provide: getRepositoryToken(GoogleIntegrationSchedule),
                    useValue: googleIntegrationScheduleRepositoryStub
                },
                {
                    provide: getRepositoryToken(AppleCalDAVIntegrationSchedule),
                    useValue: appleCalDAVIntegrationScheduleRepositoryStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: {
                        debug: sinon.stub(),
                        info: sinon.stub()
                    }
                }
            ]
        }).compile();

        service = module.get<GlobalSchedulesService>(GlobalSchedulesService);
    });

    after(() => {
        sinon.restore();
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
            timeUtilServiceStub.localizeDateTime.reset();
            nativeSchedulesServiceStub.search.reset();
            integrationsServiceLocatorStub.getIntegrationFactory.reset();
            integrationsServiceLocatorStub.getFacade.reset();

            googleCalendarIntegrationsServiceStub.findOne.reset();
            googleCalendarIntegrationsServiceStub.createCalendarEvent.reset();
            googleCalendarIntegrationsServiceStub.patchCalendarEvent.reset();
            schedulesRedisRepositoryStub.save.reset();
            scheduleRepositoryStub.save.reset();
            scheduleRepositoryStub.findBy.reset();
            scheduleRepositoryStub.findOneBy.reset();
            scheduleRepositoryStub.findOneByOrFail.reset();
            scheduleRepositoryStub.update.reset();
            googleIntegrationScheduleRepositoryStub.findOneBy.reset();
            appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.reset();

            availabilityRedisRepositoryStub.getAvailabilityBody.reset();

            serviceSandbox.restore();
        });

        describe('Test scheduled events', () => {

            const hostUUIDMock = stubOne(User).uuid;
            const eventUUIDMock = stubOne(Event).uuid;
            const scheduleStubs = stub(Schedule);

            afterEach(() => {
                scheduleRepositoryStub.findBy.reset();
                googleIntegrationSchedulesServiceStub.search.reset();
                appleIntegrationsSchedulesServiceStub.search.reset();
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

                    const googleIntegartionScheduleStubs = stub(GoogleIntegrationSchedule);
                    const appleIntegartionScheduleStubs = stub(AppleCalDAVIntegrationSchedule);

                    nativeSchedulesServiceStub.search.returns(of(scheduleStubs));
                    googleIntegrationSchedulesServiceStub.search.resolves(googleIntegartionScheduleStubs);
                    appleIntegrationsSchedulesServiceStub.search.resolves(appleIntegartionScheduleStubs);

                    const searchedSchedules = await firstValueFrom(
                        service.search(searchOption)
                    );

                    expect(searchedSchedules).ok;
                    expect(searchedSchedules.length).greaterThan(0);
                    expect(nativeSchedulesServiceStub.search.called).true;
                    expect(googleIntegrationSchedulesServiceStub.search.called).true;
                    expect(appleIntegrationsSchedulesServiceStub.search.called).true;
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

        /**
         * need to reorganize
         */
        describe
        ('Test schedule creating', () => {

            [
                {
                    description: 'should be ensured that a scheduled event is created when both Google Calendar and Zoom are integrated, and a Google Meet link associated with Zoom exists',
                    getEventStub: () => {

                        const availabilityMock = stubOne(Availability);
                        const eventStub = stubOne(Event, {
                            availability: availabilityMock,
                            contacts: [
                                { type: ContactType.ZOOM, value: 'https://zoomFakeLink' },
                                { type: ContactType.GOOGLE_MEET, value: 'https://googleMeetFakeLink' }
                            ]
                        });

                        return eventStub;
                    },
                    getScheduleStub: () => {

                        const scheduledTimesetStub = testMockUtil.getScheduledTimesetMock();
                        const scheduleStub = stubOne(Schedule, {
                            scheduledTime: scheduledTimesetStub,
                            contacts: [
                                { type: ContactType.ZOOM, value: 'https://zoomFakeLink' },
                                { type: ContactType.GOOGLE_MEET, value: 'https://googleMeetFakeLink' }
                            ],
                            conferenceLinks: []
                        });

                        return scheduleStub;
                    },
                    outboundGoogleCalendarIntegrationStub: stubOne(GoogleCalendarIntegration),
                    expectedGoogleMeetLinkGeneration: true
                }
                // test skipped: description: 'should be ensured that a scheduled event is created if Google Calendar is integrated and a Google Meet link is not set up on contacts',
                // test skipped: description: 'should be created scheduled event even if google calendar is not integrated',

            ].forEach(function({
                description,
                getEventStub,
                getScheduleStub,
                outboundGoogleCalendarIntegrationStub,
                expectedGoogleMeetLinkGeneration
            }) {

                it(description, async () => {

                    const googleIntegrationServiceStub = serviceSandbox.createStubInstance(GoogleIntegrationsService);

                    const userSettingStub = stubOne(UserSetting);
                    const userMock = stubOne(User, {
                        userSetting: userSettingStub
                    });
                    const eventStub = getEventStub();
                    const scheduleStub = getScheduleStub();

                    const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();
                    const createdCalendarEventMock = testMockUtil.getCreatedCalendarEventMock();

                    eventsServiceStub.findOneByUserWorkspaceAndUUID.resolves(eventStub);

                    calendarIntegrationsServiceLocatorStub.getAllCalendarIntegrationServices.returns([
                        googleCalendarIntegrationsServiceStub
                    ]);
                    googleCalendarIntegrationsServiceStub.findOne.returns(of(outboundGoogleCalendarIntegrationStub));

                    // integrationsServiceLocatorStub.getAllConferenceLinkIntegrationService.returns([]);
                    integrationsServiceLocatorStub.getAllConferenceLinkIntegrationService.returns([
                        googleConferenceLinkIntegrationServiceStub
                    ]);
                    googleConferenceLinkIntegrationServiceStub.getIntegrationVendor.returns(IntegrationVendor.GOOGLE);

                    availabilityRedisRepositoryStub.getAvailabilityBody.resolves(availabilityBodyMock);
                    utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);

                    const validateStub = serviceSandbox.stub(service, 'validate').returns(of(scheduleStub));

                    calendarIntegrationsServiceLocatorStub.getCalendarIntegrationService.returns(
                        googleCalendarIntegrationsServiceStub
                    );

                    googleCalendarIntegrationsServiceStub.createCalendarEvent.resolves(createdCalendarEventMock);
                    integrationsServiceLocatorStub.getIntegrationFactory.returns(googleIntegrationServiceStub);

                    const googleIntegrationStub = stubOne(GoogleIntegration);
                    googleIntegrationServiceStub.findOne.resolves(googleIntegrationStub);

                    googleConferenceLinkIntegrationServiceStub.createMeeting.resolves({
                        link: 'conferenceLink',
                        serviceName: 'google-meet',
                        type: IntegrationVendor.GOOGLE
                    });

                    googleCalendarIntegrationsServiceStub.patchCalendarEvent.resolves();

                    scheduleRepositoryStub.save.resolves(scheduleStub);
                    schedulesRedisRepositoryStub.save.returns(of(scheduleStub));

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
                    expect(integrationsServiceLocatorStub.getIntegrationFactory.called).true;
                    expect(integrationsServiceLocatorStub.getAllConferenceLinkIntegrationService.called).true;
                    expect(googleIntegrationServiceStub.findOne.called).true;
                    expect(availabilityRedisRepositoryStub.getAvailabilityBody.called).true;
                    expect(utilServiceStub.getPatchedScheduledEvent.called).true;
                    expect(validateStub.called).true;

                    expect(googleCalendarIntegrationsServiceStub.createCalendarEvent.called).equals(expectedGoogleMeetLinkGeneration);
                    expect(googleCalendarIntegrationsServiceStub.patchCalendarEvent.called).equals(expectedGoogleMeetLinkGeneration);

                    expect(scheduleRepositoryStub.save.called).true;
                    expect(schedulesRedisRepositoryStub.save.called).true;
                });
            });
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
    });

    describe('Test for Validation in Creating a Schedule', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            eventsServiceStub.findOneByUserWorkspaceAndUUID.reset();
            utilServiceStub.getPatchedScheduledEvent.reset();
            timeUtilServiceStub.localizeDateTime.reset();
            googleCalendarIntegrationsServiceStub.findOne.reset();
            googleCalendarIntegrationsServiceStub.createCalendarEvent.reset();
            googleCalendarIntegrationsServiceStub.patchCalendarEvent.reset();
            schedulesRedisRepositoryStub.save.reset();
            scheduleRepositoryStub.save.reset();
            scheduleRepositoryStub.findBy.reset();
            scheduleRepositoryStub.findOneBy.reset();
            scheduleRepositoryStub.findOneByOrFail.reset();
            scheduleRepositoryStub.update.reset();
            googleIntegrationScheduleRepositoryStub.findOneBy.reset();
            appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.reset();

            serviceSandbox.restore();
        });

        describe('Test schedule validate method', () => {
            [
                {
                    description: 'should be passed if the schedule has no conflicts for all conditions',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleMock: stubOne(Schedule, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _findOverlappingDateOverrideStubValue: undefined,
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    _isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    _isTimeOverlappingWithAvailableTimesStubCall: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be passed if the schedule is not within available time but is within the available override time',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleMock: stubOne(Schedule, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _findOverlappingDateOverrideStubValue: testMockUtil.getOverridedAvailabilityTimeMock(),
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithAvailableTimeOverridesCall: true,
                    _isTimeOverlappingWithAvailableTimeOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubCall: false,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be passed if the schedule is within available time but is not within the unavailable override availability time',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleMock: stubOne(Schedule, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _findOverlappingDateOverrideStubValue: undefined,
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    _isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    _isTimeOverlappingWithAvailableTimesStubCall: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                }
            ].forEach(function ({
                description,
                timezoneMock,
                scheduleMock,
                availabilityBodyMock,
                _findOverlappingDateOverrideStubValue,
                _isPastTimestampStubValue,
                _isTimeOverlappingWithAvailableTimeOverridesCall,
                _isTimeOverlappingWithAvailableTimeOverridesStubValue,
                _isTimeOverlappingWithAvailableTimesStubCall,
                _isTimeOverlappingWithAvailableTimesStubValue,
                conflictedScheduleStub,
                vendorIntegrationScheduleStub
            }) {
                it(description, async () => {
                    const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(_isPastTimestampStubValue);

                    serviceSandbox.stub(service, '_findOverlappingDateOverride').returns(_findOverlappingDateOverrideStubValue);

                    const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimeOverrides').returns(_isTimeOverlappingWithAvailableTimeOverridesStubValue);
                    const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(_isTimeOverlappingWithAvailableTimesStubValue);

                    scheduleRepositoryStub.findOneBy.resolves(conflictedScheduleStub);
                    googleIntegrationScheduleRepositoryStub.findOneBy.resolves(vendorIntegrationScheduleStub);
                    appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.resolves(vendorIntegrationScheduleStub);

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
                    expect(appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.called).false;

                    expect(_isPastTimestampStub.called).true;
                    expect(_isTimeOverlappingWithOverridesStub.called).equals(_isTimeOverlappingWithAvailableTimeOverridesCall);
                    expect(_isTimeOverlappingWithAvailableTimesStub.called).equals(_isTimeOverlappingWithAvailableTimesStubCall);
                });
            });
        });

        describe('Test to Validation Does Not Pass With Conflict', () => {
            [
                {
                    description: 'should be not passed if the ensured schedule start time or ensured end time is earlier than now',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleTimeMock: testMockUtil.getScheduleTimeMock(new Date(Date.now() - _1Hour)),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _findOverlappingDateOverrideStubValue: undefined,
                    _isPastTimestampStubValue: true,
                    _isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    _isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    _isTimeOverlappingWithAvailableTimesStubCall: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be not passed if the ensured schedule start time is earlier than the ensured end time: scheduledTime',
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
                    _findOverlappingDateOverrideStubValue: undefined,
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    _isTimeOverlappingWithAvailableTimeOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubCall: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be not passed if the ensured schedule start time is earlier than the ensured end time: scheduledBufferTime',
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
                    _findOverlappingDateOverrideStubValue: undefined,
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    _isTimeOverlappingWithAvailableTimeOverridesStubValue: true,
                    _isTimeOverlappingWithAvailableTimesStubCall: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be not passed if the schedule is not within the availability of the event to be scheduled and is also not within the override availability time',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleTimeMock: testMockUtil.getScheduleTimeMock(),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _findOverlappingDateOverrideStubValue: undefined,
                    _isPastTimestampStubValue: false,
                    _isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    _isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    _isTimeOverlappingWithAvailableTimesStubCall: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: false,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                }
            ].forEach(function ({
                description,
                timezoneMock,
                scheduleTimeMock,
                availabilityBodyMock,
                _findOverlappingDateOverrideStubValue,
                _isPastTimestampStubValue,
                _isTimeOverlappingWithAvailableTimeOverridesCall,
                _isTimeOverlappingWithAvailableTimeOverridesStubValue,
                _isTimeOverlappingWithAvailableTimesStubCall,
                _isTimeOverlappingWithAvailableTimesStubValue,
                conflictedScheduleStub,
                vendorIntegrationScheduleStub
            }) {
                it(description, () => {
                    const scheduleMock = stubOne(Schedule, scheduleTimeMock);

                    const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(_isPastTimestampStubValue);

                    serviceSandbox.stub(service, '_findOverlappingDateOverride').returns(_findOverlappingDateOverrideStubValue);

                    const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimeOverrides').returns(_isTimeOverlappingWithAvailableTimeOverridesStubValue);
                    const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(_isTimeOverlappingWithAvailableTimesStubValue);

                    scheduleRepositoryStub.findOneBy.resolves(conflictedScheduleStub);
                    googleIntegrationScheduleRepositoryStub.findOneBy.resolves(vendorIntegrationScheduleStub);
                    appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.resolves(vendorIntegrationScheduleStub);

                    expect(() => service.validate(scheduleMock, timezoneMock, availabilityBodyMock)).throws(CannotCreateByInvalidTimeRange);

                    expect(scheduleRepositoryStub.findOneBy.called).false;
                    expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;
                    expect(appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.called).false;

                    expect(_isPastTimestampStub.called).true;
                    expect(_isTimeOverlappingWithOverridesStub.called).equals(_isTimeOverlappingWithAvailableTimeOverridesCall);
                    expect(_isTimeOverlappingWithAvailableTimesStub.called).equals(_isTimeOverlappingWithAvailableTimesStubCall);
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
                    _findOverlappingDateOverrideStubValue: undefined,_isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    _isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    _isTimeOverlappingWithAvailableTimesStubCall: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: stubOne(Schedule),
                    googleCalendarIntegrationMock: null
                },
                {
                    description: 'should not be passed if the schedule overlaps with a Google-integrated schedule',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleMock: stubOne(Schedule, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    _isPastTimestampStubValue: false,                    _findOverlappingDateOverrideStubValue: undefined,_isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    _isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    _isTimeOverlappingWithAvailableTimesStubCall: true,
                    _isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    googleCalendarIntegrationMock: stubOne(GoogleCalendarIntegration)
                }
            ].forEach(function ({
                description,
                timezoneMock,
                scheduleMock,
                availabilityBodyMock,
                _findOverlappingDateOverrideStubValue,
                _isPastTimestampStubValue,
                _isTimeOverlappingWithAvailableTimeOverridesCall,
                _isTimeOverlappingWithAvailableTimeOverridesStubValue,
                _isTimeOverlappingWithAvailableTimesStubCall,
                _isTimeOverlappingWithAvailableTimesStubValue,
                conflictedScheduleStub,
                googleCalendarIntegrationMock
            }) {
                it(description, async () => {
                    const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(_isPastTimestampStubValue);

                    serviceSandbox.stub(service, '_findOverlappingDateOverride').returns(_findOverlappingDateOverrideStubValue);

                    const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimeOverrides').returns(_isTimeOverlappingWithAvailableTimeOverridesStubValue);
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
                            googleCalendarIntegrationMock
                        )
                    )
                    ).rejectedWith(CannotCreateByInvalidTimeRange);

                    expect(scheduleRepositoryStub.findOneBy.called).true;

                    if (conflictedScheduleStub){
                        expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;
                    } else {
                        expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).true;
                    }

                    expect(appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.called).false;
                    expect(_isPastTimestampStub.called).true;
                    expect(_isTimeOverlappingWithOverridesStub.called).equals(_isTimeOverlappingWithAvailableTimeOverridesCall);
                    expect(_isTimeOverlappingWithAvailableTimesStub.called).equals(_isTimeOverlappingWithAvailableTimesStubCall);
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
            timeUtilServiceStub.localizeDateTime.reset();
        });

        // expected result true means request schedule data is invalid.
        [
            {
                description: 'should be returned false if there is overrided availability but they have no time range without overlapping',
                timezoneMock,
                overrideMock: {
                    targetDate: new Date('2023-08-25T00:00:00'),
                    timeRanges: []
                },
                startDateTimestampMock: new Date('2023-08-24T00:00:01').getTime(),
                endDateTimestampMock: new Date('2023-08-24T01:00:01').getTime(),
                localizeDateTimeStubOnFirstCall: new Date('this is Invalid date'),
                localizeDateTimeStubOnSecondCall: new Date('this is Invalid date'),
                expectedLocalizeDateTimeCallCount: 0,
                expectedResult: false
            },
            {
                description: 'should be returned true if there is unavailable override but they have no time range with overlapping',
                timezoneMock,
                overrideMock: {
                    targetDate: new Date('2023-08-25T00:00:00'),
                    timeRanges: []
                },
                startDateTimestampMock: new Date('2023-08-24T00:00:01').getTime(),
                endDateTimestampMock: new Date('2023-08-25T00:10:00').getTime(),
                localizeDateTimeStubOnFirstCall: new Date('this is Invalid date'),
                localizeDateTimeStubOnSecondCall: new Date('this is Invalid date'),
                expectedLocalizeDateTimeCallCount: 0,
                expectedResult: true
            },
            {
                description: 'should be returned false if there are overrided availability time, and the ensured start time and end time both are not included in the available time in override',
                timezoneMock,
                overrideMock: {
                    targetDate: new Date('2023-08-25T00:00:00'),
                    timeRanges: [
                        {
                            startTime: '09:00:00',
                            endTime: '11:00:00'
                        } as TimeRange
                    ]
                } as OverridedAvailabilityTime,
                startDateTimestampMock: new Date('2023-08-25T09:00:00').getTime(),
                endDateTimestampMock: new Date('2023-08-25T10:00:00').getTime(),
                localizeDateTimeStubOnFirstCall: new Date('2023-08-25T09:00:00'),
                localizeDateTimeStubOnSecondCall: new Date('2023-08-25T11:00:00'),
                expectedLocalizeDateTimeCallCount: 2,
                expectedResult: false
            },
            {
                description: 'should be returned true if there are overrided availability time, and the ensured start time and end time both are included in the available time in override',
                timezoneMock,
                overrideMock: {
                    targetDate: new Date('2023-08-25T00:00:00'),
                    timeRanges: [
                        {
                            startTime: '09:00:00',
                            endTime: '11:00:00'
                        } as TimeRange
                    ]
                } as OverridedAvailabilityTime,
                startDateTimestampMock: new Date('2023-08-25T08:00:00').getTime(),
                endDateTimestampMock: new Date('2023-08-25T09:00:00').getTime(),
                localizeDateTimeStubOnFirstCall: new Date('2023-08-25T09:00:00'),
                localizeDateTimeStubOnSecondCall: new Date('2023-08-25T11:00:00'),
                expectedLocalizeDateTimeCallCount: 2,
                expectedResult: false
            }
        ].forEach(function ({
            description,
            timezoneMock,
            overrideMock,
            startDateTimestampMock,
            endDateTimestampMock,
            localizeDateTimeStubOnFirstCall,
            localizeDateTimeStubOnSecondCall,
            expectedLocalizeDateTimeCallCount,
            expectedResult
        }) {
            it(description, () => {

                timeUtilServiceStub.localizeDateTime.onFirstCall().returns(localizeDateTimeStubOnFirstCall);
                timeUtilServiceStub.localizeDateTime.onSecondCall().returns(localizeDateTimeStubOnSecondCall);

                const isTimeOverlappedWithOverrides = service._isTimeOverlappingWithAvailableTimeOverrides(
                    timezoneMock,
                    overrideMock,
                    startDateTimestampMock,
                    endDateTimestampMock
                );

                expect(timeUtilServiceStub.localizeDateTime.callCount).to.be.at.least(expectedLocalizeDateTimeCallCount);
                expect(isTimeOverlappedWithOverrides).equal(expectedResult);
            });
        });
    });

    describe('Test for verifying the overlap between ensured start and end date timestamp and available times', () => {
        let serviceSandbox: sinon.SinonSandbox;

        const testUTCDate = new Date('2023-08-16T08:00:00.000Z');
        const testDateTimestamp = testUTCDate.getTime();

        const timezoneMock = 'Asia/Seoul';

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            timeUtilServiceStub.dateToTimeString.reset();
            timeUtilServiceStub.localizeDateTime.reset();
            serviceSandbox.restore();
        });

        [
            {
                description: 'should be returned false if there is no availability time',
                availableTimesMock: [],
                availabilityTimezone: timezoneMock,
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
                availabilityTimezone: timezoneMock,
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
                availabilityTimezone: timezoneMock,
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
                availabilityTimezone: timezoneMock,
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
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(testDateTimestamp - _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + _1Hour),
                isTimeOverlappingWithStartDateTimeStub: true,
                isTimeOverlappingWithEndDateTimeStub: true,
                expectedResult: true
            }

        ].forEach(function ({
            description,
            availableTimesMock,
            availabilityTimezone,
            startDateTimeMock,
            endDateTimeMock,
            isTimeOverlappingWithStartDateTimeStub,
            isTimeOverlappingWithEndDateTimeStub,
            expectedResult
        }) {
            it(description, () => {
                timeUtilServiceStub.dateToTimeString.onFirstCall().returns('startTimeStringStub');
                timeUtilServiceStub.dateToTimeString.onSecondCall().returns('endTimeStringStub');

                timeUtilServiceStub.localizeDateTime.onFirstCall().returns(startDateTimeMock);
                timeUtilServiceStub.localizeDateTime.onSecondCall().returns(endDateTimeMock);

                const startWeekdayAvailableTimeStub = availableTimesMock.find((_availableTimeMock) => _availableTimeMock.day === startDateTimeMock.getDay());
                const endWeekdayAvailableTimeStub = availableTimesMock.find((_availableTimeMock) => _availableTimeMock.day === endDateTimeMock.getDay());

                const _isTimeOverlappingWithAvailableTimeRangeStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimeRange')
                    .onFirstCall().returns(isTimeOverlappingWithStartDateTimeStub)
                    .onSecondCall().returns(isTimeOverlappingWithEndDateTimeStub);

                const isTimeOverlapping = service._isTimeOverlappingWithAvailableTimes(availableTimesMock, availabilityTimezone, startDateTimeMock, endDateTimeMock);

                if (startWeekdayAvailableTimeStub && endWeekdayAvailableTimeStub) {
                    expect(_isTimeOverlappingWithAvailableTimeRangeStub.calledTwice).true;
                } else {
                    expect(_isTimeOverlappingWithAvailableTimeRangeStub.called).false;
                }

                expect(timeUtilServiceStub.dateToTimeString.calledTwice).true;
                expect(timeUtilServiceStub.localizeDateTime.calledTwice).true;
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
        timeUtilServiceStub.localizeDateTime.returns(localizedDateStub);

        const result = service._isTimeOverlappingWithAvailableTimeRange(date, timezone, timeRangesMock);

        expect(result).true;
        expect(timeUtilServiceStub.localizeDateTime.called).true;
    });

});
