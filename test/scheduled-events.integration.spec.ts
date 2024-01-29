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
import { AvailabilityService } from '@services/availability/availability.service';
import { User } from '@entity/users/user.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { Event } from '@entity/events/event.entity';
import { BufferTime } from '@entity/events/buffer-time.entity';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/scheduled-events/cannot-create-by-invalid-time-range.exception';
import { TestIntegrationUtil } from './test-integration-util';

const testIntegrationUtil = new TestIntegrationUtil();

describe('Schedule Integration Test', () => {

    let app: INestApplication;

    let userService: UserService;
    let eventsService: EventsService;
    let availabilityService: AvailabilityService;

    let bookingsController: BookingsController;
    let integrationsController: IntegrationsController;

    before(async () => {

        app = await testIntegrationUtil.initializeApp();
        userService = app.get<UserService>(UserService);
        eventsService = app.get<EventsService>(EventsService);
        availabilityService = app.get<AvailabilityService>(AvailabilityService);

        bookingsController = app.get<BookingsController>(BookingsController);
        integrationsController = app.get<IntegrationsController>(IntegrationsController);
    });

    after(() => {

        testIntegrationUtil.reset();

        sinon.restore();
    });

    describe('Test Invitee Booking', () => {

        let fakeHostUser: User;
        let fakeHostEvent: HostEvent | Event;

        let hostWorkspace: string;

        const timezone = 'Asia/Seoul';

        beforeEach(async () => {

            const newFakeHostUser = testIntegrationUtil.setNewFakeUserEmail(true);

            const loadedUser = await userService.findUserByLocalAuth(newFakeHostUser.email);

            if (!loadedUser) {
                await testIntegrationUtil.createEmailUser(newFakeHostUser);
            }

            fakeHostUser = await userService.findUserByLocalAuth(newFakeHostUser.email) as User;

            hostWorkspace = fakeHostUser.profiles[0].team.workspace as string;

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

            it('should be booked an event by invitee for email user', async () => {

                // tomorrow 10:00 for KST
                const nextWorkingDate = testIntegrationUtil.getNextWorkingDate();
                nextWorkingDate.setHours(1, 0, 0, 0);

                const _bookingStartTime = new Date(nextWorkingDate);

                const _bookingEndTime = new Date(nextWorkingDate);
                _bookingEndTime.setMinutes(10, 0, 0);

                const workspace = fakeHostUser.profiles[0].team.workspace;
                const scheduledEventResponseDto = await testIntegrationUtil.createSchedule(
                    workspace as string,
                    fakeHostEvent as HostEvent,
                    _bookingStartTime,
                    _bookingEndTime
                );

                expect(scheduledEventResponseDto).ok;
                expect(scheduledEventResponseDto.name).ok;
            });
        });

        describe('Test Invitee Booking with Host buffer time setup', () => {

            const bufferTime = {
                before: '00:30:00',
                after: '00:15:00'
            } as BufferTime;

            beforeEach(async () => {

                // set up event location to Zoom
                const events = await firstValueFrom(eventsService.search({
                    teamId: fakeHostUser.profiles[0].teamId
                }));

                fakeHostEvent = events[0];

                fakeHostEvent = await firstValueFrom(eventsService.findOne(fakeHostEvent.id, fakeHostUser.id));

                await eventsService.patch(
                    fakeHostUser.uuid,
                    fakeHostUser.id,
                    fakeHostEvent.id,
                    {
                        bufferTime
                    }
                );

                fakeHostEvent.bufferTime = bufferTime;

                const hostAvailability = await firstValueFrom(availabilityService.fetchDetail(fakeHostUser.id, fakeHostUser.uuid, fakeHostEvent.availabilityId));
                expect(hostAvailability.availableTimes.length).greaterThan(0);
            });

            afterEach(async () => {

                const hostUser = await firstValueFrom(bookingsController.fetchHost(hostWorkspace));
                expect(hostUser).ok;

                await testIntegrationUtil.clearSchedule(hostUser.workspace);

                await userService.deleteUser(fakeHostUser.id);
            });

            it('should be not booked an event when an invitee requests a time slot from 09:00 to 09:30, and host requires a 30min buffer time before the event, starting their work time at 09:00', async () => {

                const nextWorkingDate = testIntegrationUtil.getNextWorkingDate();
                nextWorkingDate.setHours(0, 0, 0, 0);

                const bookingStartTime = new Date(nextWorkingDate);
                const bookingEndTime = new Date(nextWorkingDate);
                bookingEndTime.setMinutes(30, 0, 0);

                const beforeBufferTime = new Date(bookingStartTime);
                beforeBufferTime.setMinutes(beforeBufferTime.getMinutes() - 30);
                const afterBufferTime = new Date(bookingEndTime);
                afterBufferTime.setMinutes(afterBufferTime.getMinutes() + 15);

                const workspace = fakeHostUser.profiles[0].team.workspace;
                await expect(testIntegrationUtil.createSchedule(
                    workspace as string,
                    fakeHostEvent as HostEvent,
                    bookingStartTime,
                    bookingEndTime,
                    beforeBufferTime
                )).rejectedWith(CannotCreateByInvalidTimeRange);
            });

            it('should be booked an event when an invitee requests a time slot from 09:30 to 10:00, and host requires a 30min buffer time before the event, starting their work time at 09:00', async () => {
                const nextWorkingDate = testIntegrationUtil.getNextWorkingDate();
                nextWorkingDate.setHours(0, 30, 0, 0);

                const bookingStartTime = new Date(nextWorkingDate);

                const bookingEndTime = new Date(nextWorkingDate);
                bookingEndTime.setHours(1, 0);

                const workspace = fakeHostUser.profiles[0].team.workspace;
                const scheduledEventResponseDto = await testIntegrationUtil.createSchedule(
                    workspace as string,
                    fakeHostEvent as HostEvent,
                    bookingStartTime,
                    bookingEndTime
                );

                expect(scheduledEventResponseDto).ok;
                expect(scheduledEventResponseDto.name).ok;
            });

            it('should be not booked an event when an invitee requests a second time slot of the day from 10:30 to 11:00, and host requires a 30min buffer time before the event with 15min buffer time after the event, starting their work time at 09:00, there is a first booked event on that day (09:30 ~ 10:00) ', async () => {
                const nextWorkingDate = testIntegrationUtil.getNextWorkingDate();
                nextWorkingDate.setHours(0, 30, 0, 0);

                const someonesBookingStartTime = new Date(nextWorkingDate);
                const someonesBookingEndTime = new Date(nextWorkingDate);
                someonesBookingEndTime.setHours(1, 0);

                const someonesBookingBufferStartTime = new Date(someonesBookingStartTime);
                someonesBookingBufferStartTime.setMinutes(someonesBookingBufferStartTime.getMinutes() - 30);

                const someonesBookingBufferEndTime = new Date(someonesBookingEndTime);
                someonesBookingBufferEndTime.setMinutes(someonesBookingBufferEndTime.getMinutes() + 15);

                const workspace = fakeHostUser.profiles[0].team.workspace;
                await testIntegrationUtil.createSchedule(
                    workspace as string,
                    fakeHostEvent as HostEvent,
                    someonesBookingStartTime,
                    someonesBookingEndTime,
                    someonesBookingBufferStartTime,
                    someonesBookingBufferEndTime
                );

                const inviteeBookingStartTime = new Date(nextWorkingDate);
                inviteeBookingStartTime.setHours(1, 30);
                const inviteeBookingEndTime = new Date(nextWorkingDate);
                inviteeBookingEndTime.setHours(2, 0);

                const inviteeBookingBufferStartTime = new Date(inviteeBookingStartTime);
                inviteeBookingBufferStartTime.setMinutes(inviteeBookingBufferStartTime.getMinutes() - 30);

                const inviteeBookingBufferEndTime = new Date(inviteeBookingEndTime);
                inviteeBookingBufferEndTime.setMinutes(inviteeBookingBufferEndTime.getMinutes() + 15);

                await expect(testIntegrationUtil.createSchedule(
                    workspace as string,
                    fakeHostEvent as HostEvent,
                    inviteeBookingStartTime,
                    inviteeBookingEndTime,
                    inviteeBookingBufferStartTime,
                    inviteeBookingBufferEndTime
                )).rejectedWith(CannotCreateByInvalidTimeRange);
            });

            it('should be booked an event when an invitee requests a second time slot of the day from 11:00 to 11:30 and host requires a 30min buffer time before the event with 15min buffer time after the event, starting their work time at 09:00, there is a first booked event on that day (09:30 ~ 10:00, last schedule end time + after buffer + before buffer for new one = 10:45. Therefore second time slot is 11:00)', async () => {
                const nextWorkingDate = testIntegrationUtil.getNextWorkingDate();
                nextWorkingDate.setHours(0, 30);

                const someonesBookingStartTime = new Date(nextWorkingDate);
                const someonesBookingEndTime = new Date(nextWorkingDate);
                someonesBookingEndTime.setHours(1, 0);

                const someonesBookingBufferStartTime = new Date(someonesBookingStartTime);
                someonesBookingBufferStartTime.setMinutes(someonesBookingBufferStartTime.getMinutes() - 30);

                const someonesBookingBufferEndTime = new Date(someonesBookingEndTime);
                someonesBookingBufferEndTime.setMinutes(someonesBookingBufferEndTime.getMinutes() + 15);

                const workspace = fakeHostUser.profiles[0].team.workspace;
                await testIntegrationUtil.createSchedule(
                    workspace as string,
                    fakeHostEvent as HostEvent,
                    someonesBookingStartTime,
                    someonesBookingEndTime,
                    someonesBookingBufferStartTime,
                    someonesBookingBufferEndTime
                );

                const inviteeBookingStartTime = new Date(nextWorkingDate);
                inviteeBookingStartTime.setHours(2, 0);
                const inviteeBookingEndTime = new Date(nextWorkingDate);
                inviteeBookingEndTime.setHours(2, 30);

                const inviteeBookingBufferStartTime = new Date(inviteeBookingStartTime);
                inviteeBookingBufferStartTime.setMinutes(inviteeBookingBufferStartTime.getMinutes() - 30);

                const inviteeBookingBufferEndTime = new Date(inviteeBookingEndTime);
                inviteeBookingBufferEndTime.setMinutes(inviteeBookingBufferEndTime.getMinutes() + 15);

                const createdSecondScheduledEvent =await testIntegrationUtil.createSchedule(
                    workspace as string,
                    fakeHostEvent as HostEvent,
                    inviteeBookingStartTime,
                    inviteeBookingEndTime,
                    inviteeBookingBufferStartTime,
                    inviteeBookingBufferEndTime
                );
                expect(createdSecondScheduledEvent).ok;
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

                        const profile = fakeHostUser.profiles[0];
                        const workspace = profile.team.workspace;
                        hostWorkspace = workspace as string;

                        // set up Calendar Outbound setting
                        const _withCalendarIntegrations = true;
                        const loadedIntegrations = await firstValueFrom(integrationsController.fetchAllIntegrations(
                            profile,
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

                                const team = fakeHostUser.profiles[0].team;
                                // set up event location to Zoom
                                const events = await firstValueFrom(eventsService.search({
                                    teamId: team.id
                                }));

                                fakeHostEvent = events[0];

                                const newContacts = [
                                    { type: ContactType.ZOOM, value: null as unknown as string }
                                ];

                                await eventsService.patch(
                                    fakeHostUser.uuid,
                                    fakeHostUser.id,
                                    fakeHostEvent.id,
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
                                    teamId: fakeHostUser.id
                                }));
                                fakeHostEvent = events[0];
                                const newContacts = [
                                    { type: ContactType.GOOGLE_MEET, value: null as unknown as string }
                                ];

                                const team = fakeHostUser.profiles[0].team;

                                await eventsService.patch(
                                    team.uuid,
                                    team.id,
                                    fakeHostEvent.id,
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

                                const profile = fakeHostUser.profiles[0];

                                // setting for multiple outbound
                                const loadedIntegrations = await firstValueFrom(integrationsController.fetchAllIntegrations(
                                    profile,
                                    IntegrationSubject.CALENDAR,
                                    true
                                )) as Array<Integration & { calendarIntegrations: CalendarIntegration[] }>;

                                const googleCalendarIntegration = loadedIntegrations.filter((_loadedIntegration) => _loadedIntegration.vendor === IntegrationVendor.GOOGLE)
                                    .map((_loadedIntegration) => _loadedIntegration.calendarIntegrations[0]).pop() as CalendarIntegration;

                                await testIntegrationUtil.addOutboundCalendar(fakeHostUser.id, googleCalendarIntegration);

                                // set up event location to Zoom and Google Meet
                                const events = await firstValueFrom(eventsService.search({
                                    teamId: fakeHostUser.id
                                }));
                                fakeHostEvent = events[0];
                                const newContacts = [
                                    { type: ContactType.GOOGLE_MEET, value: null as unknown as string },
                                    { type: ContactType.ZOOM, value: null as unknown as string }
                                ];

                                await eventsService.patch(
                                    fakeHostUser.uuid,
                                    fakeHostUser.id,
                                    fakeHostEvent.id,
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

                            const profile = fakeHostUser.profiles[0];
                            const workspace = profile.team.workspace;
                            const scheduledEventResponseDto = await testIntegrationUtil.createSchedule(
                                workspace as string,
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
