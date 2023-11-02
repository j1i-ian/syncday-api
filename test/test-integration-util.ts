import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER, WinstonModule } from 'nest-winston';
import { Auth } from 'googleapis';
import { Cluster } from 'ioredis';
import { Logger } from 'winston';
import { INestApplication } from '@nestjs/common';
import { Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { routes } from '@config/routes';
import { AppConfigService } from '@config/app-config.service';
import { Language } from '@interfaces/users/language.enum';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { ReminderType } from '@interfaces/reminders/reminder-type.enum';
import { HostEvent } from '@interfaces/bookings/host-event';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { CalendarIntegration } from '@interfaces/integrations/calendar-integration.interface';
import { UserModule } from '@services/users/user.module';
import { UtilModule } from '@services/util/util.module';
import { IntegrationsModule } from '@services/integrations/integrations.module';
import { WorkspacesModule } from '@services/workspaces/workspaces.module';
import { AvailabilityModule } from '@services/availability/availability.module';
import { EventsModule } from '@services/events/events.module';
import { SyncdayAwsSdkClientModule } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.module';
import { BookingsModule } from '@services/bookings/bookings.module';
import { SchedulesModule } from '@services/schedules/schedules.module';
import { GoogleOAuthClientService } from '@services/integrations/google-integration/facades/google-oauth-client.service';
import { GoogleOAuthTokenService } from '@services/integrations/google-integration/facades/google-oauth-token.service';
import { GoogleOAuthUserService } from '@services/integrations/google-integration/facades/google-oauth-user.service';
import { GoogleCalendarListService } from '@services/integrations/google-integration/facades/google-calendar-list.service';
import { GoogleCalendarEventListService } from '@services/integrations/google-integration/facades/google-calendar-event-list.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { UserController } from '@services/users/user.controller';
import { TemporaryUsersController } from '@services/users/temporary-users/temporary-users.controller';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { BookingsController } from '@services/bookings/bookings.controller';
import { GoogleCalendarEventCreateService } from '@services/integrations/google-integration/facades/google-calendar-event-create.service';
import { GoogleCalendarEventPatchService } from '@services/integrations/google-integration/facades/google-calendar-event-patch.service';
import { VendorIntegrationsController } from '@services/integrations/vendor-integrations.controller';
import { ZoomOauthTokenService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-token.service';
import { ZoomOauthUserService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-user.service';
import { CalendarIntegrationsController } from '@services/integrations/calendar-integrations/calendar-integrations.controller';
import { ZoomCreateMeetingService } from '@services/integrations/zoom-integrations/facades/zoom-create-meeting.service';
import { AppleCaldavClientService } from '@services/integrations/apple-integrations/facades/apple-caldav-client.service';
import { AppleCalendarListService } from '@services/integrations/apple-integrations/facades/apple-calendar-list.service';
import { AppleCalendarEventListService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-list.service';
import { AppleCalendarEventCreateService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-create.service';
import { AppleCalendarEventPatchService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-patch.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { User } from '@entity/users/user.entity';
import { Verification } from '@entity/verifications/verification.interface';
import { QuestionInputType } from '@entity/invitee-questions/question-input-type.enum';
import { Schedule } from '@entity/schedules/schedule.entity';
import { GoogleIntegrationSchedule } from '@entity/integrations/google/google-integration-schedule.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { CreateUserWithVerificationDto } from '@dto/verifications/create-user-with-verification.dto';
import { CreateTemporaryUserRequestDto } from '@dto/users/create-temporary-user-request.dto';
import { CreateScheduledRequestDto } from '@dto/schedules/create-scheduled-request.dto';
import { ScheduledEventResponseDto } from '@dto/schedules/scheduled-event-response.dto';
import { CreateAppleCalDAVRequestDto } from '@dto/integrations/apple/create-apple-cal-dav-request.dto';
import { AuthModule } from '@app/auth/auth.module';
import { VerificationController } from '@app/auth/verification/verification.controller';
import { TokenController } from '@app/auth/token/token.controller';
import { ZoomUserResponseDTO } from '@app/interfaces/integrations/zoom/zoom-user-response.interface';
import { TokenService } from '@app/auth/token/token.service';
import { ClusterModule, DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { TestMockUtil } from '@test/test-mock-util';
import { faker } from '@faker-js/faker';


const testMockUtil = new TestMockUtil();

/**
 * When configuring the Service Layer, the context is currently flowing through the controller,
 * which is affecting the integration test structure.
 * Except for API-related tasks like parsing HTTP requests,
 * all the logic within the controllers should be encapsulated within the service layer
 */
export class TestIntegrationUtil {

    app: INestApplication;

    redisCluster: Cluster;
    logger: Logger;

    calendarIntegrationsController: CalendarIntegrationsController;
    vendorIntegrationsController: VendorIntegrationsController;
    bookingsController: BookingsController;
    userController: UserController;
    tokenController: TokenController;
    temporaryUsersController: TemporaryUsersController;
    verificationController: VerificationController;

    tokenService: TokenService;
    syncdayRedisService: SyncdayRedisService;
    googleCalendarIntegrationsService: GoogleCalendarIntegrationsService;

    // for user test
    googleCalendarIntegrationsServiceSubscribeCalendarStub: sinon.SinonStub;
    generateGoogleOAuthClientStub: sinon.SinonStub;
    issueGoogleTokenByAuthorizationCodeStub: sinon.SinonStub;
    getGoogleUserInfoStub: sinon.SinonStub;
    googleCalendarListServiceSearchStub: sinon.SinonStub;
    googleCalendarEventListServiceSearchStub: sinon.SinonStub;

    // for schedule test
    googleCalendarEventCreateServiceCreateStub: sinon.SinonStub;
    googleCalendarEventPatchServicePatchStub: sinon.SinonStub;

    // for schedule with Zoom outbound test
    zoomOauthTokenServiceStub: sinon.SinonStubbedInstance<ZoomOauthTokenService>;
    zoomOauthUserServiceStub: sinon.SinonStubbedInstance<ZoomOauthUserService>;
    zoomCreateMeetingServiceStub: sinon.SinonStubbedInstance<ZoomCreateMeetingService>;

    // Prevent to send a email to fake account email address.
    notificationServiceStub: sinon.SinonStubbedInstance<NotificationsService>;

    // for schedule with Apple outbound test
    appleCaldavClientServiceStub: sinon.SinonStubbedInstance<AppleCaldavClientService>;
    appleCalendarListServiceStub: sinon.SinonStubbedInstance<AppleCalendarListService>;
    appleCalendarEventListServiceStub: sinon.SinonStubbedInstance<AppleCalendarEventListService>;
    appleCalendarEventCreateServiceStub: sinon.SinonStubbedInstance<AppleCalendarEventCreateService>;
    appleCalendarEventPatchServiceStub: sinon.SinonStubbedInstance<AppleCalendarEventPatchService>;

    scheduleRepository: Repository<Schedule>;
    googleScheduleRepository: Repository<GoogleIntegrationSchedule>;
    appleScheduleRepository: Repository<AppleCalDAVIntegrationSchedule>;

    async initializeApp(): Promise<INestApplication> {

        if (!this.app) {

            const moduleFixture = await this.initializeModule();

            this.app = moduleFixture.createNestApplication();

            await this.app.init();

            this.redisCluster = this.app.get<Cluster>(getClusterToken(DEFAULT_CLUSTER_NAMESPACE));
            this.logger = this.app.get<Logger>(WINSTON_MODULE_PROVIDER);

            this.calendarIntegrationsController = this.app.get<CalendarIntegrationsController>(CalendarIntegrationsController);
            this.vendorIntegrationsController = this.app.get<VendorIntegrationsController>(VendorIntegrationsController);
            this.bookingsController = this.app.get<BookingsController>(BookingsController);
            this.userController = this.app.get<UserController>(UserController);
            this.tokenController = this.app.get<TokenController>(TokenController);
            this.temporaryUsersController = this.app.get<TemporaryUsersController>(TemporaryUsersController);
            this.verificationController = this.app.get<VerificationController>(VerificationController);

            this.tokenService = this.app.get<TokenService>(TokenService);
            this.syncdayRedisService = this.app.get<SyncdayRedisService>(SyncdayRedisService);
            this.googleCalendarIntegrationsService = this.app.get<GoogleCalendarIntegrationsService>(GoogleCalendarIntegrationsService);

            this.scheduleRepository = this.app.get(getRepositoryToken(Schedule));
            this.googleScheduleRepository = this.app.get(getRepositoryToken(GoogleIntegrationSchedule));
            this.appleScheduleRepository = this.app.get(getRepositoryToken(AppleCalDAVIntegrationSchedule));
        }


        return this.app;
    }

    reset(): void {
        this.googleCalendarIntegrationsServiceSubscribeCalendarStub.reset();
        this.generateGoogleOAuthClientStub.reset();
        this.issueGoogleTokenByAuthorizationCodeStub.reset();
        this.getGoogleUserInfoStub.reset();
        this.googleCalendarListServiceSearchStub.reset();
    }

    async createEmailUser(
        fakeUser: User
    ): Promise<Pick<User, 'email' | 'name'>> {

        const userTimezoneISO8601Seoul = 'Asia/Seoul';
        const plainPassword = faker.internet.password();

        const isVerificationValid = await this.verificationController.create(
            {
                email: fakeUser.email
            },
            Language.ENGLISH
        );

        this.logger.debug('isVerificationValid', isVerificationValid);
        expect(isVerificationValid).ok;

        // Retrieve the generated verification code. Users can find the code in their email
        const _emailVerificationCodeRedisKey = this.syncdayRedisService.getEmailVerificationKey(fakeUser.email);
        const _generatedEmailVerificationCodeJsonString = await this.redisCluster.get(_emailVerificationCodeRedisKey);
        const _generatedEmailVerificationCode = JSON.parse(_generatedEmailVerificationCodeJsonString as string) as Verification;

        this.logger.debug('_generatedEmailVerificationCode', _generatedEmailVerificationCode);
        expect(_generatedEmailVerificationCode.email).equals(fakeUser.email);
        expect(_generatedEmailVerificationCode.verificationCode).not.null;

        // The FE app also requests permission to record user data. After verification, this data will be used to create a host.
        const createTemporaryUserRequestDto: CreateTemporaryUserRequestDto = {
            email: fakeUser.email,
            name: fakeUser.name,
            plainPassword
        };

        const createdTemporaryUser = await this.temporaryUsersController.createTemporaryUser(
            createTemporaryUserRequestDto,
            Language.KOREAN
        );
        this.logger.debug('createdTemporaryUser', createdTemporaryUser);
        expect(createdTemporaryUser).ok;

        // (anonymous) User will sign up with verification code with own email
        const createUserWithVerificationDto: CreateUserWithVerificationDto = {
            email: fakeUser.email,
            timezone: userTimezoneISO8601Seoul,
            verificationCode: _generatedEmailVerificationCode.verificationCode
        };

        const createdUser = await this.userController.createUserWithEmailVerification(createUserWithVerificationDto);

        this.logger.info(createdUser);
        expect(createdUser).ok;
        expect(createdUser.email).equals(fakeUser.email);
        expect(createdUser.name).equals(fakeUser.name);

        return createdUser;
    }

    async integrateGoogleOAuthUser(
        integrationContext: IntegrationContext,
        timezone: string,
        accessToken: string | null | undefined,
        serviceSandbox: sinon.SinonSandbox
    ): Promise<void> {
        const _responseWriteHeadStub = serviceSandbox.stub();
        const _responseEndStub = serviceSandbox.stub();

        const _responseSetHeaderStub = serviceSandbox.stub();
        const _responseRedirectStub = serviceSandbox.stub();

        const googleOAuthUrlGenerationExpressResponseMock = {
            writeHead: _responseWriteHeadStub,
            end: _responseEndStub
        } as Partial<Response> as Response;
        const googleOAuthCallbackResponseMock = {
            setHeader: _responseSetHeaderStub,
            redirect: _responseRedirectStub
        } as Partial<Response> as Response;

        // FE app redirects the user to the /v1/tokens/google API to obtain an OAuth2 authorization URL
        this.tokenController.issueTokenWithGoogleOAuth2(
            integrationContext,
            timezone,
            accessToken,
            googleOAuthUrlGenerationExpressResponseMock
        );

        expect(_responseWriteHeadStub.called).true;
        expect(_responseEndStub.called).true;

        const generatedAuthorizationUrlParam = _responseWriteHeadStub.getCall(0).args[1];
        const generatedAuthorizationUrl = generatedAuthorizationUrlParam.Location;
        expect(generatedAuthorizationUrl).ok;

        const expressRequestMock = testMockUtil.getGoogleOAuthCallbackRequestMock(integrationContext);

        await this.tokenController.googleOAuthCallback(
            expressRequestMock,
            Language.ENGLISH,
            googleOAuthCallbackResponseMock
        );

        expect(_responseSetHeaderStub.called).true;
        expect(_responseRedirectStub.called).true;
        const issuedAccessToken = _responseSetHeaderStub.getCall(0).args[1] as string;
        expect(issuedAccessToken).ok;

        const generatedRedirectURL = _responseRedirectStub.getCall(0).args[0] as string;
        expect(generatedRedirectURL).ok;
    }

    getAccessToken(user: User): string {
        const issuedToken = this.tokenService.issueToken(user);
        return issuedToken.accessToken;
    }

    async integrateZoomOAuth(
        serviceSandbox: sinon.SinonSandbox,
        user: User
    ): Promise<void> {

        const issuedToken = this.tokenService.issueToken(user);
        const issuedAccessToken = issuedToken.accessToken;

        this.setZoomUser();

        const _responseWriteHeadStub = serviceSandbox.stub();
        const _responseEndStub = serviceSandbox.stub();
        const _responseSetHeaderStub = serviceSandbox.stub();
        const _responseRedirectStub = serviceSandbox.stub();

        const zoomIntegrationResponseStub = {
            writeHead: _responseWriteHeadStub,
            end: _responseEndStub
        } as Partial<Response> as Response;

        const zoomOAuthCallbackResponseMock = {
            setHeader: _responseSetHeaderStub,
            redirect: _responseRedirectStub
        } as Partial<Response> as Response;

        this.vendorIntegrationsController.redirectForOAuth2(
            issuedAccessToken,
            IntegrationVendor.ZOOM,
            zoomIntegrationResponseStub
        );
        expect(_responseWriteHeadStub.called).true;
        expect(_responseEndStub.called).true;

        const zoomOAuthCallbackRequestMock = testMockUtil.getZoomOAuthCallbackRequestMock(
            issuedAccessToken
        );

        const zoomAuthCode = testMockUtil.getZoomAuthCode();

        const oauthTokenMock = testMockUtil.getOAuthTokenMock();

        this.zoomOauthTokenServiceStub.issueOAuthTokenByAuthorizationCode.resolves(oauthTokenMock);
        this.zoomOauthTokenServiceStub.issueOAuthTokenByRefreshToken.resolves(oauthTokenMock);

        await this.vendorIntegrationsController.callbackForOAuth2(
            zoomAuthCode,
            IntegrationVendor.ZOOM,
            zoomOAuthCallbackRequestMock,
            zoomOAuthCallbackResponseMock
        );

        expect(this.zoomOauthTokenServiceStub.issueOAuthTokenByAuthorizationCode.called).true;
    }

    async integrateApple(
        user: User,
        timezone: string
    ): Promise<void> {

        const newIntegration: CreateAppleCalDAVRequestDto = {
            username: faker.name.fullName(),
            password: faker.datatype.uuid(),
            timezone
        };

        await this.vendorIntegrationsController.createIntegration(
            user,
            IntegrationVendor.APPLE,
            newIntegration
        );
    }

    async clearSchedule(
        workspace: string
    ): Promise<void> {

        await this.scheduleRepository.delete({
            host: {
                workspace
            }
        });

        await this.googleScheduleRepository.delete({
            host: {
                workspace
            }
        });

        await this.appleScheduleRepository.delete({
            host: {
                workspace
            }
        });
    }

    async clearAllIntegrations(
        userId: number
    ): Promise<void> {

        await Promise.all(
            Object.values(IntegrationVendor)
                .map(async (_integrationVendor) => {
                    const allIntegrations = await this.vendorIntegrationsController.searchIntegrations(
                        userId,
                        _integrationVendor,
                        true
                    );
                    return await Promise.all(
                        allIntegrations.map(async (integration) =>
                            await this.vendorIntegrationsController.remove(
                                userId,
                                _integrationVendor,
                                integration.id
                            )
                        )
                    );

                })
        );
    }

    async createSchedule(
        hostWorkspace: string,
        hostEvent: HostEvent,
        _bookingStartTime: Date,
        _bookingEndTime: Date
    ): Promise<ScheduledEventResponseDto> {

        const inviteeTimezone = 'Asia/Seoul';

        const createScheduledRequestDto: CreateScheduledRequestDto = {
            workspace: hostWorkspace,
            scheduledTime: {
                startTimestamp: _bookingStartTime,
                endTimestamp: _bookingEndTime
            },
            scheduledBufferTime: {
                startBufferTimestamp: _bookingStartTime,
                endBufferTimestamp: _bookingEndTime
            },
            inviteeAnswers: [
                {
                    inputType: QuestionInputType.TEXT,
                    name: 'testname',
                    required: true
                }
            ],
            scheduledNotificationInfo: {
                invitee: [
                    {
                        type: NotificationType.EMAIL,
                        reminders: [
                            {
                                typeValue: 'testemail@gmail.com'
                            }
                        ]
                    },
                    {
                        type: NotificationType.TEXT,
                        reminders: [
                            {
                                type: ReminderType.SMS,
                                typeValue: '+821012341234'
                            }
                        ]
                    }
                ]
            },
            meetingNote: 'test meeting note ~',
            invitee: {
                timezone: inviteeTimezone
            },
            eventUUID: hostEvent.uuid
        };

        const scheduledEventResponseDto = await firstValueFrom(
            this.bookingsController.createScheduledEvent(
                createScheduledRequestDto,
                Language.KOREAN
            )
        );

        return scheduledEventResponseDto;
    }

    async setupOutboundCalendar(
        fakeHostUser: User,
        timezone: string,
        calendarIntegration: CalendarIntegration,
        integrationVendor: IntegrationVendor
    ): Promise<boolean> {

        const updatedCalendarIntegration = {
            id: calendarIntegration.id,
            uuid: calendarIntegration.uuid,
            name: fakeHostUser.email,
            description: fakeHostUser.email,
            color: '#0e61b9',
            primary: true,
            timezone,
            writable: true,
            setting: {
                conflictCheck: false,
                outboundWriteSync: true,
                inboundDecliningSync: false
            },
            vendor: integrationVendor
        } as CalendarIntegration;

        const success = await firstValueFrom(this.calendarIntegrationsController.patchAllCalendarIntegrations(
            fakeHostUser.id,
            [updatedCalendarIntegration]
        ));

        return success;
    }

    /**
     * Add a second outbound calendar.
     * Currently, our product only supports a unique outbound calendar.
     * However, we will support multiple outbound calendars in the future.
     * This method is designed for that purpose
     */
    addOutboundCalendar(
        userId: number,
        calendarIntegration: CalendarIntegration
    ): Promise<boolean> {
        calendarIntegration.setting = {
            conflictCheck: true,
            inboundDecliningSync: true,
            outboundWriteSync: true
        };

        return this.googleCalendarIntegrationsService.patchAll(
            userId,
            [calendarIntegration]
        );
    }

    getFakeUser(): User {

        const fakeUserName = faker.internet.userName();
        const fakeUser = {
            email: faker.internet.email(fakeUserName),
            name: fakeUserName
        } as User;

        return fakeUser;
    }

    setNewFakeUserEmail(
        withGoogleProfileSetting = false,
        newFakeUserEmail = faker.internet.email(faker.name.fullName())
    ): User {

        const fakeUser = this.getFakeUser();

        fakeUser.email = newFakeUserEmail;

        if (withGoogleProfileSetting) {
            this.setNewFakerGoogleUserEmail(newFakeUserEmail);
        }

        return fakeUser;
    }

    setNewFakerGoogleUserEmail(newFakeUserEmail: string): void {

        this.getGoogleUserInfoStub.reset();
        this.getGoogleUserInfoStub.resolves({
            email: newFakeUserEmail
        });

    }

    getGoogleCalendarEventCreateServiceCreateStub(): sinon.SinonStub {
        return this.googleCalendarEventCreateServiceCreateStub;
    }

    getGoogleCalendarEventPatchServicePatchStub(): sinon.SinonStub {
        return this.googleCalendarEventPatchServicePatchStub;
    }

    getNextWorkingDate(): Date {
        const nextWorkingDay = new Date();

        // 10:00 KST
        nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);

        if (nextWorkingDay.getDay() === 6 || nextWorkingDay.getDay() === 0) {
            nextWorkingDay.setDate(nextWorkingDay.getDate() + 2);
        }
        return nextWorkingDay;
    }

    setZoomUser(
        zoomUserStub: ZoomUserResponseDTO = testMockUtil.getZoomUser()
    ): void {

        this.zoomOauthUserServiceStub.getZoomUser.resolves(zoomUserStub);
    }

    setZoomMeeting(): void {

        const zoomMeetingStub = testMockUtil.getZoomMeetingMock();

        this.zoomCreateMeetingServiceStub.createZoomMeeting.resolves(zoomMeetingStub);
    }

    setGoogleCalendarEventStubs(
        googleScheduleMock = testMockUtil.getGoogleScheduleMock()
    ): void {
        this.googleCalendarEventCreateServiceCreateStub.resolves(googleScheduleMock);
    }

    setAppleCalendarStubs(userEmail: string): void {

        const calDAVClientMock = testMockUtil.getCalDavClientMock(userEmail);
        const calDAVCalendarStubs = testMockUtil.getCalDavCalendarMocks();
        const calDAVCalendarObjectStubs = testMockUtil.getCalDavObjectMocks();

        this.appleCaldavClientServiceStub.generateCalDAVClient.resolves(calDAVClientMock);
        this.appleCalendarListServiceStub.search.resolves(calDAVCalendarStubs);
        this.appleCalendarEventListServiceStub.search.resolves(calDAVCalendarObjectStubs);
        this.appleCalendarEventCreateServiceStub.create.resolves('');
        this.appleCalendarEventPatchServiceStub.patch.resolves('');
    }

    resetAppleCalendarServiceStubs(): void {

        this.appleCaldavClientServiceStub.generateCalDAVClient.reset();
        this.appleCalendarListServiceStub.search.reset();
        this.appleCalendarEventListServiceStub.search.reset();
        this.appleCalendarEventCreateServiceStub.create.reset();
        this.appleCalendarEventPatchServiceStub.patch.reset();
    }

    private async initializeModule(): Promise<TestingModule> {

        this.zoomOauthTokenServiceStub = sinon.createStubInstance(ZoomOauthTokenService);
        this.zoomOauthUserServiceStub = sinon.createStubInstance(ZoomOauthUserService);
        this.zoomCreateMeetingServiceStub = sinon.createStubInstance(ZoomCreateMeetingService);

        this.notificationServiceStub = sinon.createStubInstance(NotificationsService);
        this.notificationServiceStub._sendNotification.resolves(true);
        this.notificationServiceStub.sendWelcomeEmailForNewUser.resolves(true);
        this.notificationServiceStub.sendMessage.resolves(true);
        this.notificationServiceStub.sendCancellationMessages.resolves(true);

        this.appleCaldavClientServiceStub = sinon.createStubInstance(AppleCaldavClientService);
        this.appleCalendarListServiceStub = sinon.createStubInstance(AppleCalendarListService);
        this.appleCalendarEventListServiceStub = sinon.createStubInstance(AppleCalendarEventListService);
        this.appleCalendarEventCreateServiceStub = sinon.createStubInstance(AppleCalendarEventCreateService);
        this.appleCalendarEventPatchServiceStub = sinon.createStubInstance(AppleCalendarEventPatchService);

        const googleAuthorizationUrlStub = testMockUtil.getGoogleAuthorizationUrlMock();
        const googleOAuthTokenStub = testMockUtil.getGoogleOAuthTokenMock();

        this.googleCalendarIntegrationsServiceSubscribeCalendarStub = sinon.stub(
            GoogleCalendarIntegrationsService.prototype,
            'subscribeCalendar'
        );

        this.generateGoogleOAuthClientStub = sinon.stub(
            GoogleOAuthClientService.prototype,
            'generateGoogleOAuthClient'
        );

        const oauth2ClientStub = sinon.createStubInstance(Auth.OAuth2Client);
        oauth2ClientStub.generateAuthUrl.returns(googleAuthorizationUrlStub);
        this.generateGoogleOAuthClientStub.returns(oauth2ClientStub);

        this.issueGoogleTokenByAuthorizationCodeStub = sinon.stub(
            GoogleOAuthTokenService.prototype,
            'issueGoogleTokenByAuthorizationCode'
        );

        this.issueGoogleTokenByAuthorizationCodeStub.resolves(googleOAuthTokenStub);

        this.getGoogleUserInfoStub = sinon.stub(
            GoogleOAuthUserService.prototype,
            'getGoogleUserInfo'
        );

        const googleCalendarsMock = testMockUtil.getGoogleCalendarsMock();
        this.googleCalendarListServiceSearchStub = sinon.stub(
            GoogleCalendarListService.prototype,
            'search'
        );
        this.googleCalendarListServiceSearchStub.resolves(googleCalendarsMock);

        const googleEventsMock = testMockUtil.getGoogleEventsMock();
        this.googleCalendarEventListServiceSearchStub = sinon.stub(
            GoogleCalendarEventListService.prototype,
            'search'
        );
        this.googleCalendarEventListServiceSearchStub.resolves(googleEventsMock);

        this.googleCalendarEventCreateServiceCreateStub = sinon.stub(
            GoogleCalendarEventCreateService.prototype,
            'create'
        );

        this.googleCalendarEventPatchServicePatchStub = sinon.stub(
            GoogleCalendarEventPatchService.prototype,
            'patch'
        );

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    envFilePath: AppConfigService.getDotenvConfigs()
                }),
                RouterModule.register(routes),
                TypeOrmModule.forRootAsync(AppConfigService.getDatabaseConfigs()),
                WinstonModule.forRootAsync(AppConfigService.getWinstonModuleSetting()),
                ClusterModule.forRootAsync(AppConfigService.getRedisModuleOptions()),

                UserModule,

                AuthModule,

                UtilModule,

                IntegrationsModule,

                WorkspacesModule,

                AvailabilityModule,

                EventsModule,

                SyncdayAwsSdkClientModule,
                BookingsModule,
                SchedulesModule
            ]
        })
            .overrideProvider(ZoomOauthTokenService)
            .useValue(this.zoomOauthTokenServiceStub)
            .overrideProvider(ZoomOauthUserService)
            .useValue(this.zoomOauthUserServiceStub)
            .overrideProvider(ZoomCreateMeetingService)
            .useValue(this.zoomCreateMeetingServiceStub)
            .overrideProvider(NotificationsService)
            .useValue(this.notificationServiceStub)
            .overrideProvider(AppleCaldavClientService)
            .useValue(this.appleCaldavClientServiceStub)
            .overrideProvider(AppleCalendarListService)
            .useValue(this.appleCalendarListServiceStub)
            .overrideProvider(AppleCalendarEventListService)
            .useValue(this.appleCalendarEventListServiceStub)
            .overrideProvider(AppleCalendarEventCreateService)
            .useValue(this.appleCalendarEventCreateServiceStub)
            .overrideProvider(AppleCalendarEventPatchService)
            .useValue(this.appleCalendarEventPatchServiceStub)
            .compile();

        return moduleFixture;
    }
}
