import { INestApplication } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { IntegrationSubject } from '@interfaces/integrations/integration-subject.enum';
import { HostEvent } from '@interfaces/bookings/host-event';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { CalendarIntegration } from '@interfaces/integrations/calendar-integration.interface';
import { UserService } from '@services/users/user.service';
import { BookingsController } from '@services/bookings/bookings.controller';
import { IntegrationsController } from '@services/integrations/integrations.controller';
import { EventsService } from '@services/events/events.service';
import { User } from '@entity/users/user.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { Event } from '@entity/events/event.entity';
import { TestIntegrationUtil } from './test-integration-util';

const testIntegrationUtil = new TestIntegrationUtil();

describe('Schedule Integration Test', () => {

    let app: INestApplication;

    let userService: UserService;
    let eventsService: EventsService;

    let bookingsController: BookingsController;
    let integrationsController: IntegrationsController;

    before(async () => {

        app = await testIntegrationUtil.initializeApp();
        userService = app.get<UserService>(UserService);
        eventsService = app.get<EventsService>(EventsService);

        bookingsController = app.get<BookingsController>(BookingsController);
        integrationsController = app.get<IntegrationsController>(IntegrationsController);
    });

    after(() => {

        testIntegrationUtil.reset();

        sinon.restore();
    });

    describe('Invitee can schedule an appointment for host user', () => {

        let fakeHostUser: User;
        let fakeHostEvent: HostEvent | Event;

        let hostWorkspace: string;

        const timezone = 'Asia/Seoul';

        beforeEach(async () => {

            const newFakeHostUser = testIntegrationUtil.setNewFakeUserEmail(true);

            const loadedUser = await userService.findUserByEmail(newFakeHostUser.email);

            if (!loadedUser) {
                await testIntegrationUtil.createEmailUser(newFakeHostUser);
            }

            fakeHostUser = await userService.findUserByEmail(newFakeHostUser.email) as User;

            hostWorkspace = fakeHostUser.workspace as string;

            // fetch host events
            const hostEventDtoArray = await firstValueFrom(bookingsController.fetchHostEvents(hostWorkspace));
            expect(hostEventDtoArray.length).greaterThan(0);

            fakeHostEvent = hostEventDtoArray[0] as HostEvent;

            // fetch host availabilities
            const hostAvailabilityDto = await firstValueFrom(bookingsController.searchHostAvailabilities(
                hostWorkspace,
                fakeHostEvent.link
            ));
            expect(hostAvailabilityDto).ok;

            // fetching host data
            const hostUser = await firstValueFrom(bookingsController.fetchHost(hostWorkspace));
            expect(hostUser).ok;
        });

        afterEach(async () => {
            await testIntegrationUtil.clearSchedule(hostWorkspace);
        });

        describe('Test booking for email user', () => {

            it('should be booked an appointment by invitee for email user', async () => {

                // tomorrow 10:00 for KST
                const nextWorkingDate = testIntegrationUtil.getNextWorkingDate();
                nextWorkingDate.setHours(1, 0, 0, 0);

                const _bookingStartTime = new Date(nextWorkingDate);

                const _bookingEndTime = new Date(nextWorkingDate);
                _bookingEndTime.setMinutes(10, 0, 0);

                const scheduledEventResponseDto = await testIntegrationUtil.createSchedule(
                    fakeHostUser.workspace as string,
                    fakeHostEvent as HostEvent,
                    _bookingStartTime,
                    _bookingEndTime
                );

                expect(scheduledEventResponseDto).ok;
                expect(scheduledEventResponseDto.name).ok;
            });
        });

        describe('Calendar Outbound Test', () => {

            let serviceSandbox: sinon.SinonSandbox;

            let googleCalendarEventCreateServiceCreateStub: sinon.SinonStub;
            let googleCalendarEventPatchServicePatchStub: sinon.SinonStub;

            let bookingStartTime: Date;
            let bookingEndTime: Date;

            // TODO: it should be parameterized for email user / google oauth user too.
            [
                {
                    description: 'Google Calendar Outbound Test',
                    integrationVendor: IntegrationVendor.GOOGLE,
                    integrateVendor: async (_fakeHostUser: User) => {

                        const accessToken = testIntegrationUtil.getAccessToken(_fakeHostUser);

                        await testIntegrationUtil.integrateGoogleOAuthUser(
                            IntegrationContext.INTEGRATE,
                            timezone,
                            accessToken,
                            serviceSandbox
                        );
                    },
                    setCalendarEventStubs: () => {

                        testIntegrationUtil.setGoogleCalendarEventStubs();

                        googleCalendarEventCreateServiceCreateStub = testIntegrationUtil.getGoogleCalendarEventCreateServiceCreateStub();
                        googleCalendarEventPatchServicePatchStub = testIntegrationUtil.getGoogleCalendarEventPatchServicePatchStub();
                    },
                    resetCalendarEventStubs: () => {
                        googleCalendarEventCreateServiceCreateStub.reset();
                        googleCalendarEventPatchServicePatchStub.reset();
                    }
                },
                {
                    description: 'Apple Calendar Outbound Test',
                    integrationVendor: IntegrationVendor.APPLE,
                    integrateVendor: async (_fakeHostUser: User) => {
                        await testIntegrationUtil.integrateApple(
                            _fakeHostUser,
                            timezone
                        );

                        const accessToken = testIntegrationUtil.getAccessToken(_fakeHostUser);

                        await testIntegrationUtil.integrateGoogleOAuthUser(
                            IntegrationContext.INTEGRATE,
                            timezone,
                            accessToken,
                            serviceSandbox
                        );
                    },
                    setCalendarEventStubs: () => {

                        testIntegrationUtil.setGoogleCalendarEventStubs();

                        googleCalendarEventCreateServiceCreateStub = testIntegrationUtil.getGoogleCalendarEventCreateServiceCreateStub();
                        googleCalendarEventPatchServicePatchStub = testIntegrationUtil.getGoogleCalendarEventPatchServicePatchStub();

                        testIntegrationUtil.setAppleCalendarStubs(fakeHostUser.email);
                    },
                    resetCalendarEventStubs: () => {
                        googleCalendarEventCreateServiceCreateStub.reset();
                        googleCalendarEventPatchServicePatchStub.reset();

                        testIntegrationUtil.resetAppleCalendarServiceStubs();
                    }
                }
            ].forEach(function({
                description,
                integrationVendor,
                integrateVendor,
                setCalendarEventStubs,
                resetCalendarEventStubs
            }) {
                describe(description, () => {

                    beforeEach(async () => {

                        serviceSandbox = sinon.createSandbox();

                        setCalendarEventStubs();

                        await integrateVendor(fakeHostUser);

                        hostWorkspace = fakeHostUser.workspace as string;

                        // set up Calendar Outbound setting
                        const _withCalendarIntegrations = true;
                        const loadedIntegrations = await firstValueFrom(integrationsController.fetchAllIntegrations(
                            fakeHostUser,
                            IntegrationSubject.CALENDAR,
                            _withCalendarIntegrations
                        )) as Array<Integration & { calendarIntegrations: CalendarIntegration[] }>;
                        expect(loadedIntegrations).ok;
                        expect(loadedIntegrations.length).greaterThan(0);

                        const targetIntegration = loadedIntegrations[0];
                        expect(targetIntegration).ok;

                        const targetCalendarIntegration = targetIntegration.calendarIntegrations.filter((_calIntegration) => _calIntegration.vendor === integrationVendor).pop() as CalendarIntegration;
                        expect(targetCalendarIntegration).ok;

                        await testIntegrationUtil.setupOutboundCalendar(
                            fakeHostUser,
                            timezone,
                            targetCalendarIntegration,
                            integrationVendor
                        );

                        // fetch host events
                        const hostEventDtoArray = await firstValueFrom(bookingsController.fetchHostEvents(hostWorkspace));
                        expect(hostEventDtoArray.length).greaterThan(0);

                        fakeHostEvent = hostEventDtoArray[0] as HostEvent;

                        // fetch host availabilities
                        const hostAvailabilityDto = await firstValueFrom(bookingsController.searchHostAvailabilities(
                            hostWorkspace,
                            fakeHostEvent.link
                        ));
                        expect(hostAvailabilityDto).ok;

                        // fetching host data
                        const hostUser = await firstValueFrom(bookingsController.fetchHost(hostWorkspace));
                        expect(hostUser).ok;


                        // tomorrow 10:00 for KST
                        const nextWorkingDate = testIntegrationUtil.getNextWorkingDate();
                        nextWorkingDate.setHours(1, 0, 0, 0);

                        bookingStartTime = new Date(nextWorkingDate);

                        // tomorrow 10:10 for KST
                        bookingEndTime = new Date(nextWorkingDate);
                        bookingEndTime.setMinutes(10, 0, 0);

                        await testIntegrationUtil.clearSchedule(hostUser.workspace);
                    });

                    afterEach(async () => {

                        resetCalendarEventStubs();

                        await testIntegrationUtil.clearAllIntegrations(fakeHostUser.id);

                        await userService.deleteUser(fakeHostUser.id);

                        serviceSandbox.reset();
                        serviceSandbox.restore();
                    });

                    [
                        {
                            description: 'should be outbounded Outbound Calendar Event without conference link when the invitee books an appointment for a host user who has set up Outbound Calendar Outbound',
                            expectedConferenceLinkLength: 0,
                            initializeOutboundSetting: async () => {}
                        },
                        {
                            description: 'should be outbounded Outbound Calendar Event with Zoom conference link when the invitee books an appointment for a host user who has set up Outbound Calendar Outbound with Zoom location(contact) setting',
                            expectedConferenceLinkLength: 1,
                            initializeOutboundSetting: async () => {

                                // set up Zoom integration
                                await testIntegrationUtil.integrateZoomOAuth(
                                    serviceSandbox,
                                    fakeHostUser
                                );

                                testIntegrationUtil.setZoomMeeting();

                                // set up event location to Zoom
                                const events = await firstValueFrom(eventsService.search({
                                    userId: fakeHostUser.id
                                }));

                                fakeHostEvent = events[0];

                                const newContacts = [
                                    { type: ContactType.ZOOM, value: null as unknown as string }
                                ];

                                await eventsService.patch(
                                    fakeHostEvent.id,
                                    fakeHostUser.id,
                                    {
                                        contacts: newContacts
                                    }
                                );

                                fakeHostEvent.contacts = newContacts;
                            }
                        },
                        {
                            description: 'should be outbounded Outbound Calendar Event with Google Meet conference link when the invitee books an appointment for a host user who has set up Outbound Calendar Outbound with Google Meet location (contact) setting',
                            expectedConferenceLinkLength: integrationVendor === IntegrationVendor.GOOGLE ? 1 : 0,
                            initializeOutboundSetting: async () => {

                                const timezone = 'Asia/Seoul';

                                const accessToken = testIntegrationUtil.getAccessToken(fakeHostUser);

                                // set up Google Meet integration
                                await testIntegrationUtil.integrateGoogleOAuthUser(
                                    IntegrationContext.INTEGRATE,
                                    timezone,
                                    accessToken,
                                    serviceSandbox
                                );

                                // set up event location to Zoom
                                const events = await firstValueFrom(eventsService.search({
                                    userId: fakeHostUser.id
                                }));
                                fakeHostEvent = events[0];
                                const newContacts = [
                                    { type: ContactType.GOOGLE_MEET, value: null as unknown as string }
                                ];

                                await eventsService.patch(
                                    fakeHostEvent.id,
                                    fakeHostUser.id,
                                    {
                                        contacts: newContacts
                                    }
                                );

                                fakeHostEvent.contacts = newContacts;
                            }
                        },
                        {
                            description: 'should be outbounded Outbound Calendar Event with Google Meet and Zoom both conference link when the invitee books an appointment for a host user who has set up Outbound Calendar Outbound with Multiple locations (contacts) setting',
                            expectedConferenceLinkLength: 2,
                            initializeOutboundSetting: async () => {

                                const timezone = 'Asia/Seoul';

                                // set up Zoom integration
                                await testIntegrationUtil.integrateZoomOAuth(
                                    serviceSandbox,
                                    fakeHostUser
                                );

                                testIntegrationUtil.setZoomMeeting();

                                const accessToken = testIntegrationUtil.getAccessToken(fakeHostUser);

                                // set up Google Meet integration
                                await testIntegrationUtil.integrateGoogleOAuthUser(
                                    IntegrationContext.INTEGRATE,
                                    timezone,
                                    accessToken,
                                    serviceSandbox
                                );

                                // setting for multiple outbound
                                const loadedIntegrations = await firstValueFrom(integrationsController.fetchAllIntegrations(
                                    fakeHostUser,
                                    IntegrationSubject.CALENDAR,
                                    true
                                )) as Array<Integration & { calendarIntegrations: CalendarIntegration[] }>;

                                const googleCalendarIntegration = loadedIntegrations.filter((_loadedIntegration) => _loadedIntegration.vendor === IntegrationVendor.GOOGLE)
                                    .map((_loadedIntegration) => _loadedIntegration.calendarIntegrations[0]).pop() as CalendarIntegration;

                                await testIntegrationUtil.addOutboundCalendar(fakeHostUser.id, googleCalendarIntegration);

                                // set up event location to Zoom and Google Meet
                                const events = await firstValueFrom(eventsService.search({
                                    userId: fakeHostUser.id
                                }));
                                fakeHostEvent = events[0];
                                const newContacts = [
                                    { type: ContactType.GOOGLE_MEET, value: null as unknown as string },
                                    { type: ContactType.ZOOM, value: null as unknown as string }
                                ];

                                await eventsService.patch(
                                    fakeHostEvent.id,
                                    fakeHostUser.id,
                                    {
                                        contacts: newContacts
                                    }
                                );

                                fakeHostEvent.contacts = newContacts;
                            }
                        }
                    ].forEach(function({
                        description,
                        expectedConferenceLinkLength,
                        initializeOutboundSetting
                    }) {

                        it(description, async () => {

                            await initializeOutboundSetting();

                            const scheduledEventResponseDto = await testIntegrationUtil.createSchedule(
                                fakeHostUser.workspace as string,
                                fakeHostEvent as HostEvent,
                                bookingStartTime,
                                bookingEndTime
                            );

                            expect(scheduledEventResponseDto).ok;
                            expect(scheduledEventResponseDto.name).ok;
                            expect(scheduledEventResponseDto.conferenceLinks.length).greaterThanOrEqual(expectedConferenceLinkLength);
                        });
                    });
                });
            });
        });
    });
});
