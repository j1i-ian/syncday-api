import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { HostProfile } from '@interfaces/scheduled-events/host-profile.interface';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { ScheduledEventsRedisRepository } from '@services/scheduled-events/scheduled-events.redis-repository';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { NativeScheduledEventsService } from '@services/scheduled-events/native-scheduled-events.service';
import { GoogleIntegrationSchedulesService } from '@services/integrations/google-integration/google-integration-schedules/google-integration-schedules.service';
import { AppleIntegrationsSchedulesService } from '@services/integrations/apple-integrations/apple-integrations-schedules/apple-integrations-schedules.service';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { GoogleConferenceLinkIntegrationService } from '@services/integrations/google-integration/google-conference-link-integration/google-conference-link-integration.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { GoogleIntegrationScheduledEvent } from '@entity/integrations/google/google-integration-scheduled-event.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledBufferTime } from '@entity/scheduled-events/scheduled-buffer-time.entity';
import { ScheduledTimeset } from '@entity/scheduled-events/scheduled-timeset.entity';
import { AppleCalDAVIntegrationScheduledEvent } from '@entity/integrations/apple/apple-caldav-integration-scheduled-event.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Team } from '@entity/teams/team.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { ScheduledEventNotification } from '@entity/scheduled-events/scheduled-event-notification.entity';
import { ConferenceLink } from '@entity/scheduled-events/conference-link.entity';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/scheduled-events/cannot-create-by-invalid-time-range.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { GlobalScheduledEventsService } from './global-scheduled-events.service';

const testMockUtil = new TestMockUtil();

describe('GlobalScheduledEventsService', () => {
    let service: GlobalScheduledEventsService;

    let integrationsServiceLocatorStub: sinon.SinonStubbedInstance<IntegrationsServiceLocator>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let timeUtilServiceStub: sinon.SinonStubbedInstance<TimeUtilService>;

    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let nativeSchedulesServiceStub: sinon.SinonStubbedInstance<NativeScheduledEventsService>;
    let calendarIntegrationsServiceLocatorStub: sinon.SinonStubbedInstance<CalendarIntegrationsServiceLocator>;

    let googleCalendarIntegrationsServiceStub: sinon.SinonStubbedInstance<GoogleCalendarIntegrationsService>;
    let schedulesRedisRepositoryStub: sinon.SinonStubbedInstance<ScheduledEventsRedisRepository>;
    let scheduledEventRepositoryStub: sinon.SinonStubbedInstance<Repository<ScheduledEvent>>;
    let googleIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegrationScheduledEvent>>;
    let appleCalDAVIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVIntegrationScheduledEvent>>;

    let googleIntegrationSchedulesServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationSchedulesService>;
    let appleIntegrationsSchedulesServiceStub: sinon.SinonStubbedInstance<AppleIntegrationsSchedulesService>;
    const _1Hour = 60 * 60 * 1000;

    let googleConferenceLinkIntegrationServiceStub: sinon.SinonStubbedInstance<GoogleConferenceLinkIntegrationService>;
    let notificationsServiceStub: sinon.SinonStubbedInstance<NotificationsService>;

    before(async () => {

        integrationsServiceLocatorStub = sinon.createStubInstance(IntegrationsServiceLocator);
        utilServiceStub = sinon.createStubInstance(UtilService);
        timeUtilServiceStub = sinon.createStubInstance(TimeUtilService);

        eventsServiceStub = sinon.createStubInstance(EventsService);
        nativeSchedulesServiceStub = sinon.createStubInstance(NativeScheduledEventsService);
        calendarIntegrationsServiceLocatorStub = sinon.createStubInstance(CalendarIntegrationsServiceLocator);

        googleCalendarIntegrationsServiceStub = sinon.createStubInstance(GoogleCalendarIntegrationsService);
        schedulesRedisRepositoryStub = sinon.createStubInstance(ScheduledEventsRedisRepository);
        scheduledEventRepositoryStub = sinon.createStubInstance<Repository<ScheduledEvent>>(Repository);
        googleIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegrationScheduledEvent>>(
            Repository
        );
        appleCalDAVIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVIntegrationScheduledEvent>>(
            Repository
        );

        googleIntegrationSchedulesServiceStub = sinon.createStubInstance(GoogleIntegrationSchedulesService);
        appleIntegrationsSchedulesServiceStub = sinon.createStubInstance(AppleIntegrationsSchedulesService);
        integrationsServiceLocatorStub.getAllIntegrationScheduledEventsService.returns([
            googleIntegrationSchedulesServiceStub,
            appleIntegrationsSchedulesServiceStub
        ]);

        googleConferenceLinkIntegrationServiceStub = sinon.createStubInstance(GoogleConferenceLinkIntegrationService);
        notificationsServiceStub = sinon.createStubInstance(NotificationsService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GlobalScheduledEventsService,
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
                    provide: NativeScheduledEventsService,
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
                    provide: ScheduledEventsRedisRepository,
                    useValue: schedulesRedisRepositoryStub
                },
                {
                    provide: NotificationsService,
                    useValue: notificationsServiceStub
                },
                {
                    provide: getRepositoryToken(ScheduledEvent),
                    useValue: scheduledEventRepositoryStub
                },
                {
                    provide: getRepositoryToken(GoogleIntegrationScheduledEvent),
                    useValue: googleIntegrationScheduleRepositoryStub
                },
                {
                    provide: getRepositoryToken(AppleCalDAVIntegrationScheduledEvent),
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

        service = module.get<GlobalScheduledEventsService>(GlobalScheduledEventsService);
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
            eventsServiceStub.findOneByTeamWorkspaceAndUUID.reset();
            utilServiceStub.getPatchedScheduledEvent.reset();
            timeUtilServiceStub.localizeDateTime.reset();
            nativeSchedulesServiceStub.search.reset();
            integrationsServiceLocatorStub.getIntegrationFactory.reset();
            integrationsServiceLocatorStub.getFacade.reset();

            googleCalendarIntegrationsServiceStub.findOne.reset();
            googleCalendarIntegrationsServiceStub.createCalendarEvent.reset();
            googleCalendarIntegrationsServiceStub.patchCalendarEvent.reset();
            schedulesRedisRepositoryStub.save.reset();
            scheduledEventRepositoryStub.save.reset();
            scheduledEventRepositoryStub.findBy.reset();
            scheduledEventRepositoryStub.findOneBy.reset();
            scheduledEventRepositoryStub.findOneByOrFail.reset();
            scheduledEventRepositoryStub.update.reset();
            googleIntegrationScheduleRepositoryStub.findOneBy.reset();
            appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.reset();

            serviceSandbox.restore();
        });

        describe('Test scheduled events', () => {

            const hostUUIDMock = stubOne(User).uuid;
            const eventUUIDMock = stubOne(Event).uuid;
            const scheduledEventStubs = stub(ScheduledEvent);

            afterEach(() => {
                scheduledEventRepositoryStub.findBy.reset();
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

                    const googleIntegartionScheduleStubs = stub(GoogleIntegrationScheduledEvent);
                    const appleIntegartionScheduleStubs = stub(AppleCalDAVIntegrationScheduledEvent);

                    nativeSchedulesServiceStub.search.returns(of(scheduledEventStubs));
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

            const scheduledEventStub = stubOne(ScheduledEvent);
            const scheduledEventBodyStub = testMockUtil.getScheduledEventBodyMock();

            scheduledEventRepositoryStub.findOneByOrFail.resolves(scheduledEventStub);
            schedulesRedisRepositoryStub.getScheduledEventBody.returns(of(scheduledEventBodyStub));

            const fetchedScheduledEvent = await firstValueFrom(
                service.findOne(scheduledEventStub.uuid)
            );

            expect(fetchedScheduledEvent).ok;
            expect(scheduledEventRepositoryStub.findOneByOrFail.called).true;
        });

        describe('Scheduled Event Creating Test', () => {

            describe('Test Creating the scheduled event by booking with transaction', () => {

                let serviceSandbox: sinon.SinonSandbox;

                beforeEach(() => {
                    serviceSandbox = sinon.createSandbox();
                });

                afterEach(() => {
                    notificationsServiceStub.sendScheduledEventNotifications.reset();

                    scheduledEventRepositoryStub.update.reset();

                    serviceSandbox.restore();
                });


                /**
                 * Public Create Method Spec
                 */
                [
                    {
                        description: 'should be created scheduled event without notification',
                        scheduledEventNotificationsStub: [],
                        notificationRequestCall: false
                    },
                    {
                        description: 'should be generated the email notifications for scheduled event',
                        scheduledEventNotificationsStub: stub(ScheduledEventNotification, 1),
                        notificationRequestCall: true
                    }
                ].forEach(function({
                    description,
                    scheduledEventNotificationsStub,
                    notificationRequestCall
                }) {

                    it(description, async () => {

                        const teamMock = stubOne(Team, {
                            teamSetting: stubOne(TeamSetting)
                        });
                        const teamSettingMock = teamMock.teamSetting;
                        const teamWorkspaceMock = teamSettingMock.workspace;

                        const eventTypeMock = stubOne(Event);
                        const newScheduledEventMock = stubOne(ScheduledEvent);
                        const availability = stubOne(Availability);

                        const profilesMock = stub(Profile) as unknown as HostProfile[];
                        const updateResultMock = TestMockUtil.getTypeormUpdateResultMock();

                        const createdScheduledEventStub = stubOne(ScheduledEvent, {
                            scheduledEventNotifications: scheduledEventNotificationsStub
                        });

                        const _createStub = serviceSandbox
                            .stub(service, '_create');

                        _createStub.returns(of(createdScheduledEventStub));

                        notificationsServiceStub.sendScheduledEventNotifications.returns(of(true));
                        scheduledEventRepositoryStub.update.resolves(updateResultMock);

                        const actualScheduledEvent = await firstValueFrom(
                            service.create(
                                teamWorkspaceMock,
                                eventTypeMock.uuid,
                                newScheduledEventMock,
                                teamMock,
                                profilesMock,
                                availability
                            )
                        );

                        expect(actualScheduledEvent).ok;

                        expect(_createStub.called).true;
                        expect(notificationsServiceStub.sendScheduledEventNotifications.called).equals(notificationRequestCall);
                        expect(scheduledEventRepositoryStub.update.called).true;
                    });
                });
            });

            /**
             * Private Create Method Spec
             */
            describe('Test Creating the scheduled event by booking with transaction', () => {

                afterEach(() => {
                    eventsServiceStub.findOneByTeamWorkspaceAndUUID.reset();
                    googleCalendarIntegrationsServiceStub.findOne.reset();
                    integrationsServiceLocatorStub.getAllConferenceLinkIntegrationService.reset();
                    utilServiceStub.getPatchedScheduledEvent.reset();
                    googleCalendarIntegrationsServiceStub.createCalendarEvent.reset();
                    googleCalendarIntegrationsServiceStub.patchCalendarEvent.reset();
                    scheduledEventRepositoryStub.save.reset();
                    schedulesRedisRepositoryStub.save.reset();

                    serviceSandbox.restore();
                });

                [
                    {
                        description: 'should be ensured that a scheduled event is created when both Google Calendar and Zoom are integrated, and a Google Meet link associated with Zoom exists',
                        getEventStub: () => {

                            const eventStub = stubOne(Event, {
                                contacts: [
                                    { type: ContactType.ZOOM, value: 'https://zoomFakeLink' },
                                    { type: ContactType.GOOGLE_MEET, value: 'https://googleMeetFakeLink' }
                                ]
                            });

                            return eventStub;
                        },
                        getScheduleStub: () => {

                            const scheduledTimesetStub = testMockUtil.getScheduledTimesetMock();
                            const scheduledEventStub = stubOne(ScheduledEvent, {
                                scheduledTime: scheduledTimesetStub,
                                contacts: [
                                    { type: ContactType.ZOOM, value: 'https://zoomFakeLink' },
                                    { type: ContactType.GOOGLE_MEET, value: 'https://googleMeetFakeLink' }
                                ],
                                conferenceLinks: []
                            });

                            return scheduledEventStub;
                        },
                        outboundGoogleCalendarIntegrationStub: stubOne(GoogleCalendarIntegration)
                    }
                    // test skipped: description: 'should be ensured that a scheduled event is created if Google Calendar is integrated and a Google Meet link is not set up on contacts',
                    // test skipped: description: 'should be created scheduled event even if google calendar is not integrated',

                ].forEach(function({
                    description,
                    getEventStub,
                    getScheduleStub,
                    outboundGoogleCalendarIntegrationStub
                }) {

                    it(description, async () => {

                        const hostAvailabilityMock = stubOne(Availability);
                        const hostAvailabilityBodyMock = testMockUtil.getAvailabilityBodyMock(hostAvailabilityMock);
                        hostAvailabilityMock.availableTimes = hostAvailabilityBodyMock.availableTimes;
                        hostAvailabilityMock.overrides = hostAvailabilityBodyMock.overrides;

                        const teamSettingMock = stubOne(TeamSetting);
                        const profileMock = stubOne(Profile) as unknown as HostProfile;
                        const teamMock = stubOne(Team);
                        const eventStub = getEventStub();
                        const scheduleStub = getScheduleStub();

                        const createdCalendarEventMock = testMockUtil.getCreatedCalendarEventMock();

                        const conferenceLinkStub = {
                            link: 'conferenceLink',
                            serviceName: 'google-meet',
                            type: IntegrationVendor.GOOGLE
                        } as ConferenceLink;

                        const updateStub = TestMockUtil.getTypeormUpdateResultMock();

                        eventsServiceStub.findOneByTeamWorkspaceAndUUID.returns(of(eventStub));

                        utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);

                        calendarIntegrationsServiceLocatorStub.getAllCalendarIntegrationServices.returns([
                            googleCalendarIntegrationsServiceStub
                        ]);

                        // integrationsServiceLocatorStub.getAllConferenceLinkIntegrationService.returns([]);
                        integrationsServiceLocatorStub.getAllConferenceLinkIntegrationService.returns([
                            googleConferenceLinkIntegrationServiceStub
                        ]);

                        googleCalendarIntegrationsServiceStub.findOne.returns(of(outboundGoogleCalendarIntegrationStub));

                        const validateStub = serviceSandbox.stub(service, 'validate').returns(of(scheduleStub));

                        googleConferenceLinkIntegrationServiceStub.getIntegrationVendor.returns(IntegrationVendor.GOOGLE);

                        calendarIntegrationsServiceLocatorStub.getCalendarIntegrationService.returns(
                            googleCalendarIntegrationsServiceStub
                        );

                        googleCalendarIntegrationsServiceStub.createCalendarEvent.resolves(createdCalendarEventMock);

                        serviceSandbox.stub(service, '__createConferenceLinkByProfileId')
                            .resolves(conferenceLinkStub);

                        googleCalendarIntegrationsServiceStub.patchCalendarEvent.resolves();

                        scheduledEventRepositoryStub.save.resolves(scheduleStub);
                        scheduledEventRepositoryStub.update.resolves(updateStub);
                        schedulesRedisRepositoryStub.save.returns(of(scheduleStub));

                        const createdSchedule = await firstValueFrom(
                            service._create(
                                {
                                    getRepository: () => scheduledEventRepositoryStub
                                } as unknown as any,
                                teamSettingMock.workspace,
                                eventStub.uuid,
                                scheduleStub,
                                teamMock,
                                [profileMock],
                                hostAvailabilityMock
                            )
                        );

                        expect(createdSchedule).ok;
                        expect(eventsServiceStub.findOneByTeamWorkspaceAndUUID.called).true;
                        expect(validateStub.called).true;
                        expect(utilServiceStub.getPatchedScheduledEvent.called).true;

                        calendarIntegrationsServiceLocatorStub.getAllCalendarIntegrationServices.returns([
                            googleCalendarIntegrationsServiceStub
                        ]);

                        // integrationsServiceLocatorStub.getAllConferenceLinkIntegrationService.returns([]);
                        integrationsServiceLocatorStub.getAllConferenceLinkIntegrationService.returns([
                            googleConferenceLinkIntegrationServiceStub
                        ]);

                        expect(googleCalendarIntegrationsServiceStub.findOne.called).true;
                        expect(googleConferenceLinkIntegrationServiceStub.getIntegrationVendor.returns(IntegrationVendor.GOOGLE));
                        expect(calendarIntegrationsServiceLocatorStub.getCalendarIntegrationService.returns(
                            googleCalendarIntegrationsServiceStub
                        ));

                        expect(googleCalendarIntegrationsServiceStub.createCalendarEvent.called);
                        expect(googleCalendarIntegrationsServiceStub.patchCalendarEvent.called);

                        expect(scheduledEventRepositoryStub.save.called);
                        expect(schedulesRedisRepositoryStub.save.called).true;
                    });
                });
            });

            describe('Test Call the method to create conference link', () => {

                afterEach(() => {
                    googleConferenceLinkIntegrationServiceStub.getIntegrationVendor.reset();
                    integrationsServiceLocatorStub.getIntegrationFactory.reset();
                    googleConferenceLinkIntegrationServiceStub.createConferenceLink.reset();
                });

                it('should be called the method: integrationService.createConferenceLink', async () => {

                    const createdCalendarEventMock = testMockUtil.getCreatedCalendarEventMock();
                    const contacts = [
                        { type: ContactType.ZOOM, value: 'https://zoomFakeLink' },
                        { type: ContactType.GOOGLE_MEET, value: 'https://googleMeetFakeLink' }
                    ];

                    const conferenceLinkStub = {
                        link: 'conferenceLink',
                        serviceName: 'google-meet',
                        type: IntegrationVendor.GOOGLE
                    } as ConferenceLink;
                    const patchedScheduledEventDummy = {} as ScheduledEvent;
                    const timezoneDummy = stubOne(Availability).timezone;
                    const profileIdMock = 1;

                    const googleIntegrationStub = stubOne(GoogleIntegration);
                    const googleIntegrationServiceStub = serviceSandbox.createStubInstance(GoogleIntegrationsService);

                    googleConferenceLinkIntegrationServiceStub.getIntegrationVendor.returns(IntegrationVendor.GOOGLE);

                    googleIntegrationServiceStub.findOne.resolves(googleIntegrationStub);

                    integrationsServiceLocatorStub.getIntegrationFactory.returns(googleIntegrationServiceStub);

                    googleConferenceLinkIntegrationServiceStub.createConferenceLink.resolves(conferenceLinkStub);

                    await firstValueFrom(service.__createConferenceLinkByProfileId(
                        createdCalendarEventMock,
                        googleConferenceLinkIntegrationServiceStub,
                        contacts,
                        patchedScheduledEventDummy,
                        timezoneDummy,
                        profileIdMock
                    ));

                    expect(googleIntegrationServiceStub.findOne.called).true;
                    expect(integrationsServiceLocatorStub.getIntegrationFactory.called).true;
                    expect(googleConferenceLinkIntegrationServiceStub.createConferenceLink.called).true;
                });
            });
        });

        it('should be updated scheduled event', async () => {

            const scheduledEventStub = stubOne(ScheduledEvent);

            const updateResultMock = TestMockUtil.getTypeormUpdateResultMock();
            scheduledEventRepositoryStub.update.resolves(updateResultMock);

            const scheduleUpdateResult = await firstValueFrom(
                service._update(
                    {
                        getRepository: () => scheduledEventRepositoryStub
                    } as unknown as any,
                    scheduledEventStub.id,
                    {
                        color: '#000000'
                    }
                )
            );

            expect(scheduledEventRepositoryStub.update.called).true;
            expect(scheduleUpdateResult).true;

        });
    });

    describe('Test for Validation in Creating a Scheduled Event', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            eventsServiceStub.findOneByTeamWorkspaceAndUUID.reset();
            utilServiceStub.getPatchedScheduledEvent.reset();
            timeUtilServiceStub.localizeDateTime.reset();
            timeUtilServiceStub.isPastTimestamp.reset();
            timeUtilServiceStub.isTimeOverlappingWithAvailableTimeOverrides.reset();
            timeUtilServiceStub.isTimeOverlappingWithAvailableTimes.reset();
            googleCalendarIntegrationsServiceStub.findOne.reset();
            googleCalendarIntegrationsServiceStub.createCalendarEvent.reset();
            googleCalendarIntegrationsServiceStub.patchCalendarEvent.reset();
            schedulesRedisRepositoryStub.save.reset();
            scheduledEventRepositoryStub.save.reset();
            scheduledEventRepositoryStub.findBy.reset();
            scheduledEventRepositoryStub.findOneBy.reset();
            scheduledEventRepositoryStub.findOneByOrFail.reset();
            scheduledEventRepositoryStub.update.reset();
            googleIntegrationScheduleRepositoryStub.findOneBy.reset();
            appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.reset();

            serviceSandbox.restore();
        });

        describe('Test scheduled event validate method', () => {
            [
                {
                    description: 'should be passed if the scheduled event has no conflicts for all conditions',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduledEventMock: stubOne(ScheduledEvent, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    findOverlappingDateOverrideStubValue: undefined,
                    isPastTimestampStubValue: false,
                    isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    isTimeOverlappingWithAvailableTimesStubCall: true,
                    isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be passed if the scheduled event is not within available time but is within the available override time',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduledEventMock: stubOne(ScheduledEvent, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    findOverlappingDateOverrideStubValue: testMockUtil.getOverridedAvailabilityTimeMock(),
                    isPastTimestampStubValue: false,
                    isTimeOverlappingWithAvailableTimeOverridesCall: true,
                    isTimeOverlappingWithAvailableTimeOverridesStubValue: true,
                    isTimeOverlappingWithAvailableTimesStubCall: false,
                    isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be passed if the scheduled event is within available time but is not within the unavailable override availability time',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduledEventMock: stubOne(ScheduledEvent, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    findOverlappingDateOverrideStubValue: undefined,
                    isPastTimestampStubValue: false,
                    isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    isTimeOverlappingWithAvailableTimesStubCall: true,
                    isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                }
            ].forEach(function ({
                description,
                timezoneMock,
                scheduledEventMock,
                availabilityBodyMock,
                findOverlappingDateOverrideStubValue,
                isPastTimestampStubValue,
                isTimeOverlappingWithAvailableTimeOverridesCall,
                isTimeOverlappingWithAvailableTimeOverridesStubValue,
                isTimeOverlappingWithAvailableTimesStubCall,
                isTimeOverlappingWithAvailableTimesStubValue,
                conflictedScheduleStub,
                vendorIntegrationScheduleStub
            }) {
                it(description, async () => {

                    timeUtilServiceStub.isPastTimestamp.returns(isPastTimestampStubValue);
                    timeUtilServiceStub.findOverlappingDateOverride.returns(findOverlappingDateOverrideStubValue);

                    timeUtilServiceStub.isTimeOverlappingWithAvailableTimeOverrides.returns(isTimeOverlappingWithAvailableTimeOverridesStubValue);
                    timeUtilServiceStub.isTimeOverlappingWithAvailableTimes.returns(isTimeOverlappingWithAvailableTimesStubValue);

                    scheduledEventRepositoryStub.findOneBy.resolves(conflictedScheduleStub);
                    googleIntegrationScheduleRepositoryStub.findOneBy.resolves(vendorIntegrationScheduleStub);
                    appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.resolves(vendorIntegrationScheduleStub);

                    const validatedSchedule = await firstValueFrom(
                        service.validate(
                            scheduledEventMock,
                            timezoneMock,
                            availabilityBodyMock
                        )
                    );

                    expect(validatedSchedule).ok;
                    expect(scheduledEventRepositoryStub.findOneBy.called).true;
                    expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;
                    expect(appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.called).false;

                    expect(timeUtilServiceStub.isPastTimestamp.called).true;
                    expect(timeUtilServiceStub.isTimeOverlappingWithAvailableTimeOverrides.called).equals(isTimeOverlappingWithAvailableTimeOverridesCall);
                    expect(timeUtilServiceStub.isTimeOverlappingWithAvailableTimes.called).equals(isTimeOverlappingWithAvailableTimesStubCall);
                });
            });
        });

        describe('Test to Validation Does Not Pass With Conflict', () => {
            [
                {
                    description: 'should be not passed if the ensured scheduled event start time or ensured end time is earlier than now',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleTimeMock: testMockUtil.getScheduleTimeMock(new Date(Date.now() - _1Hour)),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    findOverlappingDateOverrideStubValue: undefined,
                    isPastTimestampStubValue: true,
                    isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    isTimeOverlappingWithAvailableTimesStubCall: true,
                    isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be not passed if the ensured scheduled event start time is earlier than the ensured end time: scheduledTime',
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
                    findOverlappingDateOverrideStubValue: undefined,
                    isPastTimestampStubValue: false,
                    isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    isTimeOverlappingWithAvailableTimeOverridesStubValue: true,
                    isTimeOverlappingWithAvailableTimesStubCall: true,
                    isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be not passed if the ensured scheduled event start time is earlier than the ensured end time: scheduledBufferTime',
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
                    findOverlappingDateOverrideStubValue: undefined,
                    isPastTimestampStubValue: false,
                    isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    isTimeOverlappingWithAvailableTimeOverridesStubValue: true,
                    isTimeOverlappingWithAvailableTimesStubCall: true,
                    isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                },
                {
                    description: 'should be not passed if the scheduled event is not within the availability of the event to be scheduled and is also not within the override availability time',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduleTimeMock: testMockUtil.getScheduleTimeMock(),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    findOverlappingDateOverrideStubValue: undefined,
                    isPastTimestampStubValue: false,
                    isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    isTimeOverlappingWithAvailableTimesStubCall: true,
                    isTimeOverlappingWithAvailableTimesStubValue: false,
                    conflictedScheduleStub: null,
                    vendorIntegrationScheduleStub: null
                }
            ].forEach(function ({
                description,
                timezoneMock,
                scheduleTimeMock,
                availabilityBodyMock,
                findOverlappingDateOverrideStubValue,
                isPastTimestampStubValue,
                isTimeOverlappingWithAvailableTimeOverridesCall,
                isTimeOverlappingWithAvailableTimeOverridesStubValue,
                isTimeOverlappingWithAvailableTimesStubCall,
                isTimeOverlappingWithAvailableTimesStubValue,
                conflictedScheduleStub,
                vendorIntegrationScheduleStub
            }) {
                it(description, () => {
                    const scheduledEventMock = stubOne(ScheduledEvent, scheduleTimeMock);

                    timeUtilServiceStub.isPastTimestamp.returns(isPastTimestampStubValue);
                    timeUtilServiceStub.findOverlappingDateOverride.returns(findOverlappingDateOverrideStubValue);

                    timeUtilServiceStub.isTimeOverlappingWithAvailableTimeOverrides.returns(isTimeOverlappingWithAvailableTimeOverridesStubValue);
                    timeUtilServiceStub.isTimeOverlappingWithAvailableTimes.returns(isTimeOverlappingWithAvailableTimesStubValue);

                    scheduledEventRepositoryStub.findOneBy.resolves(conflictedScheduleStub);
                    googleIntegrationScheduleRepositoryStub.findOneBy.resolves(vendorIntegrationScheduleStub);
                    appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.resolves(vendorIntegrationScheduleStub);

                    expect(() => service.validate(scheduledEventMock, timezoneMock, availabilityBodyMock)).throws(CannotCreateByInvalidTimeRange);

                    expect(scheduledEventRepositoryStub.findOneBy.called).false;
                    expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;
                    expect(appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.called).false;

                    expect(timeUtilServiceStub.isPastTimestamp.called).true;
                    expect(timeUtilServiceStub.isTimeOverlappingWithAvailableTimeOverrides.called).equals(isTimeOverlappingWithAvailableTimeOverridesCall);
                    expect(timeUtilServiceStub.isTimeOverlappingWithAvailableTimes.called).equals(isTimeOverlappingWithAvailableTimesStubCall);
                });
            });
        });

        describe('Test to Validation Does Not Pass if a ScheduledEvent Already Exists or if a ScheduledEvent Exists Google Integration', () => {
            [
                {
                    description: 'should not be passed if the scheduledEvent overlaps with an existing scheduledEvent',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduledEventMock: stubOne(ScheduledEvent, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    isPastTimestampStubValue: false,
                    findOverlappingDateOverrideStubValue: undefined,isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    isTimeOverlappingWithAvailableTimesStubCall: true,
                    isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: stubOne(ScheduledEvent),
                    googleCalendarIntegrationMock: null
                },
                {
                    description: 'should not be passed if the scheduled event overlaps with a Google-integrated scheduled event',
                    timezoneMock: stubOne(Availability).timezone,
                    scheduledEventMock: stubOne(ScheduledEvent, testMockUtil.getScheduleTimeMock()),
                    availabilityBodyMock: testMockUtil.getAvailabilityBodyMock(),
                    isPastTimestampStubValue: false,                    findOverlappingDateOverrideStubValue: undefined,isTimeOverlappingWithAvailableTimeOverridesCall: false,
                    isTimeOverlappingWithAvailableTimeOverridesStubValue: false,
                    isTimeOverlappingWithAvailableTimesStubCall: true,
                    isTimeOverlappingWithAvailableTimesStubValue: true,
                    conflictedScheduleStub: null,
                    googleCalendarIntegrationMock: stubOne(GoogleCalendarIntegration)
                }
            ].forEach(function ({
                description,
                timezoneMock,
                scheduledEventMock,
                availabilityBodyMock,
                findOverlappingDateOverrideStubValue,
                isPastTimestampStubValue,
                isTimeOverlappingWithAvailableTimeOverridesCall,
                isTimeOverlappingWithAvailableTimeOverridesStubValue,
                isTimeOverlappingWithAvailableTimesStubCall,
                isTimeOverlappingWithAvailableTimesStubValue,
                conflictedScheduleStub,
                googleCalendarIntegrationMock
            }) {
                it(description, async () => {

                    timeUtilServiceStub.isPastTimestamp.returns(isPastTimestampStubValue);
                    timeUtilServiceStub.findOverlappingDateOverride.returns(findOverlappingDateOverrideStubValue);

                    timeUtilServiceStub.isTimeOverlappingWithAvailableTimeOverrides.returns(isTimeOverlappingWithAvailableTimeOverridesStubValue);
                    timeUtilServiceStub.isTimeOverlappingWithAvailableTimes.returns(isTimeOverlappingWithAvailableTimesStubValue);

                    const googleIntegrationScheduleStub = stubOne(GoogleIntegrationScheduledEvent, {
                        googleCalendarIntegration: googleCalendarIntegrationMock ?? undefined,
                        googleCalendarIntegrationId: googleCalendarIntegrationMock?.id
                    });

                    scheduledEventRepositoryStub.findOneBy.resolves(conflictedScheduleStub);
                    googleIntegrationScheduleRepositoryStub.findOneBy.resolves(googleIntegrationScheduleStub);

                    await expect(firstValueFrom(
                        service.validate(
                            scheduledEventMock,
                            timezoneMock,
                            availabilityBodyMock,
                            googleCalendarIntegrationMock
                        )
                    )
                    ).rejectedWith(CannotCreateByInvalidTimeRange);

                    expect(scheduledEventRepositoryStub.findOneBy.called).true;

                    if (conflictedScheduleStub){
                        expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;
                    } else {
                        expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).true;
                    }

                    expect(appleCalDAVIntegrationScheduleRepositoryStub.findOneBy.called).false;

                    expect(timeUtilServiceStub.isPastTimestamp.called).true;
                    expect(timeUtilServiceStub.isTimeOverlappingWithAvailableTimeOverrides.called).equals(isTimeOverlappingWithAvailableTimeOverridesCall);
                    expect(timeUtilServiceStub.isTimeOverlappingWithAvailableTimes.called).equals(isTimeOverlappingWithAvailableTimesStubCall);
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

});
