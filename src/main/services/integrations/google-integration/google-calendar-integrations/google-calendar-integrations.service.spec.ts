import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, of } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Auth } from 'googleapis';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { IntegrationUtilsService } from '@services/util/integration-utils/integration-utils.service';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleCalendarEventListService } from '@services/integrations/google-integration/facades/google-calendar-event-list.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { ScheduledEventNotification } from '@entity/schedules/scheduled-event-notification.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleCalendarIntegrationsService } from './google-calendar-integrations.service';

const testMockUtil = new TestMockUtil();

describe('GoogleCalendarIntegrationsService', () => {
    let module: TestingModule;
    let service: GoogleCalendarIntegrationsService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let loggerStub: sinon.SinonStubbedInstance<Logger>;
    let integrationUtilsServiceStub: sinon.SinonStubbedInstance<IntegrationUtilsService>;
    let googleConverterServiceStub: sinon.SinonStubbedInstance<GoogleConverterService>;
    let integrationsRedisRepositoryStub: sinon.SinonStubbedInstance<IntegrationsRedisRepository>;

    let scheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<Schedule>>;
    let scheduledEventNotificationStub: sinon.SinonStubbedInstance<Repository<ScheduledEventNotification>>;
    let googleIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegration>>;
    let googleIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegrationSchedule>>;
    let googleCalendarIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleCalendarIntegration>>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        loggerStub = sinon.createStubInstance(Logger);
        integrationUtilsServiceStub = sinon.createStubInstance(IntegrationUtilsService);
        googleConverterServiceStub = sinon.createStubInstance(GoogleConverterService);

        integrationsRedisRepositoryStub = sinon.createStubInstance<IntegrationsRedisRepository>(IntegrationsRedisRepository);

        scheduleRepositoryStub = sinon.createStubInstance<Repository<Schedule>>(Repository);
        scheduledEventNotificationStub = sinon.createStubInstance<Repository<ScheduledEventNotification>>(Repository);
        googleIntegrationRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegration>>(Repository);
        googleIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegrationSchedule>>(Repository);
        googleCalendarIntegrationRepositoryStub =
            sinon.createStubInstance<Repository<GoogleCalendarIntegration>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                GoogleCalendarIntegrationsService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                },
                {
                    provide: IntegrationUtilsService,
                    useValue: integrationUtilsServiceStub
                },
                {
                    provide: GoogleConverterService,
                    useValue: googleConverterServiceStub
                },
                {
                    provide: IntegrationsRedisRepository,
                    useValue: integrationsRedisRepositoryStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(Schedule),
                    useValue: scheduleRepositoryStub
                },
                {
                    provide: getRepositoryToken(ScheduledEventNotification),
                    useValue: scheduledEventNotificationStub
                },
                {
                    provide: getRepositoryToken(GoogleIntegration),
                    useValue: googleIntegrationRepositoryStub
                },
                {
                    provide: getRepositoryToken(GoogleIntegrationSchedule),
                    useValue: googleIntegrationScheduleRepositoryStub
                },
                {
                    provide: getRepositoryToken(GoogleCalendarIntegration),
                    useValue: googleCalendarIntegrationRepositoryStub
                }
            ]
        }).compile();

        service = module.get<GoogleCalendarIntegrationsService>(GoogleCalendarIntegrationsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test CRUD for google calendar integration', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            googleCalendarIntegrationRepositoryStub.find.reset();
            googleCalendarIntegrationRepositoryStub.save.reset();

            integrationUtilsServiceStub.getGoogleOAuthClient.reset();
            googleConverterServiceStub.convertToGoogleIntegrationSchedules.reset();

            googleIntegrationRepositoryStub.findOneOrFail.reset();
            googleCalendarIntegrationRepositoryStub.delete.reset();
            googleIntegrationScheduleRepositoryStub.findBy.reset();
            googleIntegrationScheduleRepositoryStub.save.reset();
            googleIntegrationScheduleRepositoryStub.delete.reset();


            scheduleRepositoryStub.find.reset();
            scheduleRepositoryStub.softDelete.reset();
            scheduledEventNotificationStub.delete.reset();

            serviceSandbox.restore();
        });

        it('should be searched for calendar items', async () => {
            const userSettingStub = stubOne(UserSetting);
            const userStub = stubOne(User, {
                userSetting: userSettingStub
            });
            const googleIntegrationStub = stubOne(GoogleIntegration, {
                users: [userStub]
            });

            const googleCalendarIntegrationStub = stubOne(GoogleCalendarIntegration, {
                googleIntegration: googleIntegrationStub
            });
            const googleOAuthClientStub = testMockUtil.getGoogleOAuthClientMock();

            const serviceFindOneStub = serviceSandbox.stub(service, 'findOne');
            serviceFindOneStub.returns(of(googleCalendarIntegrationStub));

            integrationUtilsServiceStub.getGoogleOAuthClient.returns(googleOAuthClientStub);

            const _synchronizeWithGoogleCalendarEventsStub = serviceSandbox.stub(service, '_synchronizeWithGoogleCalendarEvents');

            await service.synchronizeWithGoogleCalendarEvents(googleCalendarIntegrationStub.uuid);

            expect(serviceFindOneStub.called).true;
            expect(integrationUtilsServiceStub.getGoogleOAuthClient.called).true;
            expect(_synchronizeWithGoogleCalendarEventsStub.called).true;
        });

        it('should be not searched with no calendar items', async () => {
            const googleCalendarUUIDMock = stubOne(GoogleCalendarIntegration).uuid;
            const serviceFindOneStub = serviceSandbox.stub(service, 'findOne');
            serviceFindOneStub.returns(of(null));

            const _synchronizeWithGoogleCalendarEventsStub = serviceSandbox.stub(service, '_synchronizeWithGoogleCalendarEvents');

            await service.synchronizeWithGoogleCalendarEvents(googleCalendarUUIDMock);

            expect(serviceFindOneStub.called).true;
            expect(_synchronizeWithGoogleCalendarEventsStub.called).false;
        });

        it('should be synchronized for calendar items searching', async () => {
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock();
            const oldGoogleIntegrationScheduleStubs = stub(GoogleIntegrationSchedule);
            const newGoogleIntegrationScheduleStubs = stub(GoogleIntegrationSchedule);
            newGoogleIntegrationScheduleStubs[0] = oldGoogleIntegrationScheduleStubs[0];
            newGoogleIntegrationScheduleStubs[1] = oldGoogleIntegrationScheduleStubs[1];
            newGoogleIntegrationScheduleStubs[2] = oldGoogleIntegrationScheduleStubs[2];

            const googleCalendarIntegrationMock = stubOne(GoogleCalendarIntegration);
            const userMock = stubOne(User);
            const userSettingMock = stubOne(UserSetting);
            const googleOAuthClientMock = {} as Auth.OAuth2Client;

            const googleCalendarEventListServiceSearchStub = serviceSandbox.stub(GoogleCalendarEventListService.prototype, 'search')
                .resolves(googleScheduleMock);

            const deleteTargetScheduleNotificationStubs = stub(ScheduledEventNotification);
            const deleteTargetScheduleStubs = stub(Schedule, 10, {
                scheduledEventNotifications: deleteTargetScheduleNotificationStubs
            });

            googleIntegrationScheduleRepositoryStub.findBy.resolves(oldGoogleIntegrationScheduleStubs);
            googleConverterServiceStub.convertToGoogleIntegrationSchedules.returns(newGoogleIntegrationScheduleStubs);

            scheduleRepositoryStub.find.resolves(deleteTargetScheduleStubs);

            await service._synchronizeWithGoogleCalendarEvents(
                datasourceMock as EntityManager,
                googleCalendarIntegrationMock,
                userMock.uuid,
                userSettingMock,
                {
                    googleOAuthClient: googleOAuthClientMock
                }
            );

            expect(integrationUtilsServiceStub.getGoogleOAuthClient.called).false;
            expect(googleCalendarEventListServiceSearchStub.called).true;
            expect(googleConverterServiceStub.convertToGoogleIntegrationSchedules.called).true;
            expect(googleIntegrationScheduleRepositoryStub.findBy.called).true;
            expect(googleIntegrationScheduleRepositoryStub.save.called).true;
            expect(googleIntegrationScheduleRepositoryStub.delete.called).true;

            expect(scheduleRepositoryStub.find.called).true;
            expect(scheduleRepositoryStub.softDelete.called).true;
            expect(scheduledEventNotificationStub.delete.called).true;
        });

        it('should be searched for calendar items', async () => {
            const userStub = stubOne(User);
            const calendarStubs = stub(GoogleCalendarIntegration);

            googleCalendarIntegrationRepositoryStub.find.resolves(calendarStubs as any);

            const calendars = await firstValueFrom(
                service.search({
                    userId: userStub.id
                })
            );

            expect(calendars).ok;
            expect(calendars.length).greaterThan(0);
            expect(googleCalendarIntegrationRepositoryStub.find.called).true;
        });

        it('should be patched for calendar items', async () => {
            const userSettingStub = stubOne(UserSetting);
            const userStub = stubOne(User, {
                userSetting: userSettingStub
            });
            const googleIntegrationStub = stubOne(GoogleIntegration, {
                users: [userStub]
            });

            const calendarStubs = stub(GoogleCalendarIntegration, 5, {
                setting: {
                    conflictCheck: true,
                    outboundWriteSync: true,
                    inboundDecliningSync: false
                },
                googleIntegration: googleIntegrationStub
            });

            const googleCalendarIntegrationsMock = calendarStubs[0];

            googleCalendarIntegrationRepositoryStub.find.resolves([calendarStubs[0]] as any);
            googleCalendarIntegrationRepositoryStub.save.resolves([calendarStubs[0]] as any);

            const updateResultMock = TestMockUtil.getTypeormUpdateResultMock();
            googleCalendarIntegrationRepositoryStub.update.resolves(updateResultMock);

            const deleteResultMock = TestMockUtil.getTypeormUpdateResultMock();
            googleIntegrationScheduleRepositoryStub.delete.resolves(deleteResultMock);

            const googleOAuthClientStub = testMockUtil.getGoogleOAuthClientMock();

            integrationUtilsServiceStub.getGoogleOAuthClient.returns(googleOAuthClientStub);

            const synchronizeWithGoogleCalendarEventsStub = serviceSandbox.stub(service, '_synchronizeWithGoogleCalendarEvents');
            const resubscriptionCalendarStub = serviceSandbox.stub(service, 'resubscriptionCalendar');

            const patchSuccess = await service.patch(userStub.id, [googleCalendarIntegrationsMock]);

            expect(patchSuccess).true;
            expect(googleCalendarIntegrationRepositoryStub.find.called).true;
            expect(googleCalendarIntegrationRepositoryStub.save.called).true;
            expect(googleIntegrationScheduleRepositoryStub.delete.called).true;
            expect(integrationUtilsServiceStub.getGoogleOAuthClient.called).true;
            expect(synchronizeWithGoogleCalendarEventsStub.called).true;
            expect(resubscriptionCalendarStub.called).true;
        });

        it('should be threw error when there is calendar in request array that is not owned of user', async () => {

            const userSettingStub = stubOne(UserSetting);
            const userStub = stubOne(User, {
                userSetting: userSettingStub
            });
            const googleIntegrationStub = stubOne(GoogleIntegration, {
                users: [userStub]
            });
            const calendarStubs = stub(GoogleCalendarIntegration, 1, {
                setting: {
                    conflictCheck: false,
                    outboundWriteSync: true,
                    inboundDecliningSync: false
                },
                googleIntegration: googleIntegrationStub
            });

            const googleCalendarIntegrationsMock = calendarStubs[0];

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [_first, ...rest] = calendarStubs;

            googleCalendarIntegrationRepositoryStub.find.resolves(rest as any);

            await expect(service.patch(userStub.id, [googleCalendarIntegrationsMock])).rejectedWith(
                NotAnOwnerException
            );

            expect(googleCalendarIntegrationRepositoryStub.find.called).true;
            expect(googleCalendarIntegrationRepositoryStub.save.called).false;
        });

        it('should be removed a google calendar integration by google integration id', async () => {

            const googleIntegrationStub = stubOne(GoogleIntegration);
            const googleIntegrationIdMock = googleIntegrationStub.id;
            const userStub = stubOne(User);
            const userIdMock = userStub.id;

            const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

            googleIntegrationStub.users = [userStub];

            googleIntegrationRepositoryStub.findOneOrFail.resolves(googleIntegrationStub);
            googleCalendarIntegrationRepositoryStub.delete.resolves(deleteResultStub);

            const deleteResult = await service.removeByIntegrationId(
                userIdMock,
                googleIntegrationIdMock
            );

            expect(deleteResult).true;
            expect(googleIntegrationRepositoryStub.findOneOrFail.called).true;
            expect(googleCalendarIntegrationRepositoryStub.delete.called).true;
        });

        it('should not allow the removal of a Google Calendar integration when a user who doesn\'t own the calendar requests deletion', async () => {

            const googleIntegrationStub = stubOne(GoogleIntegration);
            const googleIntegrationIdMock = googleIntegrationStub.id;
            const userStub = stubOne(User);
            const otherUserIdMock = userStub.id + 1;

            const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

            googleIntegrationStub.users = [userStub];

            googleIntegrationRepositoryStub.findOneOrFail.resolves(googleIntegrationStub);
            googleCalendarIntegrationRepositoryStub.delete.resolves(deleteResultStub);

            await expect(
                service.removeByIntegrationId(
                    otherUserIdMock,
                    googleIntegrationIdMock
                )
            ).rejectedWith(NotAnOwnerException);

            expect(googleIntegrationRepositoryStub.findOneOrFail.called).true;
            expect(googleCalendarIntegrationRepositoryStub.delete.called).false;
        });
    });
});
