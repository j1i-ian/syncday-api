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
import { NotificationsService } from '@services/notifications/notifications.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { GoogleIntegrationScheduledEvent } from '@entity/integrations/google/google-integration-scheduled-event.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { ScheduledEventNotification } from '@entity/scheduled-events/scheduled-event-notification.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Team } from '@entity/teams/team.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleCalendarIntegrationsService } from './google-calendar-integrations.service';

const testMockUtil = new TestMockUtil();

describe('GoogleCalendarIntegrationsService', () => {
    let module: TestingModule;
    let service: GoogleCalendarIntegrationsService;

    let loggerStub: sinon.SinonStub;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let integrationUtilsServiceStub: sinon.SinonStubbedInstance<IntegrationUtilsService>;
    let googleConverterServiceStub: sinon.SinonStubbedInstance<GoogleConverterService>;
    let notificationsServiceStub: sinon.SinonStubbedInstance<NotificationsService>;
    let integrationsRedisRepositoryStub: sinon.SinonStubbedInstance<IntegrationsRedisRepository>;

    let scheduledEventRepositoryStub: sinon.SinonStubbedInstance<Repository<ScheduledEvent>>;
    let scheduledEventNotificationStub: sinon.SinonStubbedInstance<Repository<ScheduledEventNotification>>;
    let googleIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegration>>;
    let googleIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegrationScheduledEvent>>;
    let googleCalendarIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleCalendarIntegration>>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    before(async () => {

        loggerStub = sinon.stub({
            debug: () => {},
            info: () => {},
            error: () => {}
        } as unknown as Logger) as unknown as sinon.SinonStub;

        configServiceStub = sinon.createStubInstance(ConfigService);
        integrationUtilsServiceStub = sinon.createStubInstance(IntegrationUtilsService);
        googleConverterServiceStub = sinon.createStubInstance(GoogleConverterService);
        notificationsServiceStub = sinon.createStubInstance(NotificationsService);

        integrationsRedisRepositoryStub = sinon.createStubInstance<IntegrationsRedisRepository>(IntegrationsRedisRepository);

        scheduledEventRepositoryStub = sinon.createStubInstance<Repository<ScheduledEvent>>(Repository);
        scheduledEventNotificationStub = sinon.createStubInstance<Repository<ScheduledEventNotification>>(Repository);
        googleIntegrationRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegration>>(Repository);
        googleIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegrationScheduledEvent>>(Repository);
        googleCalendarIntegrationRepositoryStub =
            sinon.createStubInstance<Repository<GoogleCalendarIntegration>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                GoogleCalendarIntegrationsService,
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                },
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
                    provide: NotificationsService,
                    useValue: notificationsServiceStub
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
                    provide: getRepositoryToken(ScheduledEvent),
                    useValue: scheduledEventRepositoryStub
                },
                {
                    provide: getRepositoryToken(ScheduledEventNotification),
                    useValue: scheduledEventNotificationStub
                },
                {
                    provide: getRepositoryToken(GoogleIntegrationScheduledEvent),
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

            notificationsServiceStub.sendCancellationMessages.reset();

            googleIntegrationRepositoryStub.findOneOrFail.reset();
            googleCalendarIntegrationRepositoryStub.delete.reset();
            googleIntegrationScheduleRepositoryStub.findBy.reset();
            googleIntegrationScheduleRepositoryStub.save.reset();
            googleIntegrationScheduleRepositoryStub.delete.reset();

            scheduledEventRepositoryStub.find.reset();
            scheduledEventRepositoryStub.softDelete.reset();

            serviceSandbox.restore();
        });

        it('should be searched for calendar items', async () => {
            const userSettingStub = stubOne(UserSetting);
            const teamSettingStub = stubOne(TeamSetting);
            const userStub = stubOne(User, {
                userSetting: userSettingStub
            });
            const teamStub = stubOne(Team, {
                teamSetting: teamSettingStub
            });
            const profileStub = stubOne(Profile, {
                user: userStub,
                team: teamStub
            });
            const googleIntegrationStub = stubOne(GoogleIntegration, {
                profiles: [profileStub]
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

        [
            {
                description: 'should be synchronized for calendar items searching',
                managerDummy: datasourceMock as EntityManager,
                googleCalendarIntegrationDummy: stubOne(GoogleCalendarIntegration),
                profileDummy: stubOne(Profile),
                teamSettingDummy: stubOne(TeamSetting),
                userSettingDummy: stubOne(UserSetting),
                refrashTokenAndGoogleOAuthClientDummy: {
                    userRefreshToken: 'dummyToken',
                    googleOAuthClient: {} as Auth.OAuth2Client
                },
                googleScheduleStubValue: testMockUtil.getGoogleScheduleMock(),
                deleteTargetScheduleStubsValue: stub(ScheduledEvent, 10, {
                    scheduledEventNotifications: stub(ScheduledEventNotification)
                }),
                sendCancellationMessagesStubValue: true
            },
            {
                description: 'synchronization should occur for searching calendar items, but scheduled event notifications should not be deleted and cancel messages sent when there is no target schedule to delete',
                managerDummy: datasourceMock as EntityManager,
                googleCalendarIntegrationDummy: stubOne(GoogleCalendarIntegration),
                profileDummy: stubOne(Profile),
                teamSettingDummy: stubOne(TeamSetting),
                userSettingDummy: stubOne(UserSetting),
                refrashTokenAndGoogleOAuthClientDummy: {
                    userRefreshToken: 'dummyToken',
                    googleOAuthClient: {} as Auth.OAuth2Client
                },
                googleScheduleStubValue: testMockUtil.getGoogleScheduleMock(),
                deleteTargetScheduleStubsValue: [],
                sendCancellationMessagesStubValue: true
            }
        ].forEach(function ({
            description,
            managerDummy,
            googleCalendarIntegrationDummy,
            profileDummy,
            teamSettingDummy,
            userSettingDummy,
            refrashTokenAndGoogleOAuthClientDummy,
            googleScheduleStubValue,
            deleteTargetScheduleStubsValue,
            sendCancellationMessagesStubValue
        }) {
            it(description, async () => {

                const userDummy = stubOne(User);

                const googleCalendarEventListServiceSearchStub = serviceSandbox.stub(GoogleCalendarEventListService.prototype, 'search').resolves(googleScheduleStubValue);

                const oldGoogleIntegrationScheduleStubs = stub(GoogleIntegrationScheduledEvent);
                const newGoogleIntegrationScheduleStubs = stub(GoogleIntegrationScheduledEvent);
                newGoogleIntegrationScheduleStubs[0] = oldGoogleIntegrationScheduleStubs[0];
                newGoogleIntegrationScheduleStubs[1] = oldGoogleIntegrationScheduleStubs[1];
                newGoogleIntegrationScheduleStubs[2] = oldGoogleIntegrationScheduleStubs[2];

                googleIntegrationScheduleRepositoryStub.findBy.resolves(oldGoogleIntegrationScheduleStubs);
                googleConverterServiceStub.convertToGoogleIntegrationSchedules.returns(newGoogleIntegrationScheduleStubs);

                scheduledEventRepositoryStub.find.resolves(deleteTargetScheduleStubsValue);

                notificationsServiceStub.sendCancellationMessages.resolves(sendCancellationMessagesStubValue);

                await service._synchronizeWithGoogleCalendarEvents(
                    managerDummy,
                    googleCalendarIntegrationDummy,
                    profileDummy,
                    teamSettingDummy,
                    userDummy,
                    userSettingDummy,
                    refrashTokenAndGoogleOAuthClientDummy
                );

                expect(integrationUtilsServiceStub.getGoogleOAuthClient.called).false;
                expect(googleCalendarEventListServiceSearchStub.called).true;
                expect(googleConverterServiceStub.convertToGoogleIntegrationSchedules.called).true;
                expect(googleIntegrationScheduleRepositoryStub.findBy.called).true;
                expect(googleIntegrationScheduleRepositoryStub.save.called).true;
                expect(googleIntegrationScheduleRepositoryStub.delete.called).true;

                expect(scheduledEventRepositoryStub.find.called).true;

                expect(notificationsServiceStub.sendCancellationMessages.called).equals(sendCancellationMessagesStubValue);

                expect(scheduledEventRepositoryStub.update.called).true;
                expect(scheduledEventRepositoryStub.softDelete.called).true;
            });
        });

        it('should be searched for calendar items', async () => {
            const profileStub = stubOne(Profile);
            const calendarStubs = stub(GoogleCalendarIntegration);

            googleCalendarIntegrationRepositoryStub.find.resolves(calendarStubs as any);

            const calendars = await firstValueFrom(
                service.search({
                    profileId: profileStub.id
                })
            );

            expect(calendars).ok;
            expect(calendars.length).greaterThan(0);
            expect(googleCalendarIntegrationRepositoryStub.find.called).true;
        });

        describe('Test patch', () => {

            beforeEach(() => {
                serviceSandbox = sinon.createSandbox();
                serviceSandbox.stub(service, '_resetOutboundSetting').returns(of(true));
            });

            afterEach(() => {
                serviceSandbox.reset();
                serviceSandbox.restore();
            });

            it('should be patched for calendar items', async () => {
                const userSettingStub = stubOne(UserSetting);
                const userStub = stubOne(User, {
                    userSetting: userSettingStub
                });
                const teamSettingStub = stubOne(TeamSetting);
                const teamStub = stubOne(Team, {
                    teamSetting: teamSettingStub
                });
                const profileStub = stubOne(Profile, {
                    team: teamStub,
                    user: userStub
                });
                const googleIntegrationStub = stubOne(GoogleIntegration, {
                    profiles: [profileStub]
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

                const patchSuccess = await service.patchAll(profileStub.id, [googleCalendarIntegrationsMock]);

                expect(patchSuccess).true;
                expect(googleCalendarIntegrationRepositoryStub.find.called).true;
                expect(googleCalendarIntegrationRepositoryStub.save.called).true;
                expect(googleIntegrationScheduleRepositoryStub.delete.called).true;
                expect(integrationUtilsServiceStub.getGoogleOAuthClient.called).true;
                expect(synchronizeWithGoogleCalendarEventsStub.called).true;
                expect(resubscriptionCalendarStub.called).true;
            });

            it('should be thrown error when there is calendar in request array that is not owned of user', async () => {

                const userSettingStub = stubOne(UserSetting);
                const userStub = stubOne(User, {
                    userSetting: userSettingStub
                });
                const teamSettingStub = stubOne(TeamSetting);
                const teamStub = stubOne(Team, {
                    teamSetting: teamSettingStub
                });
                const profileStub = stubOne(Profile, {
                    user: userStub,
                    team: teamStub
                });
                const googleIntegrationStub = stubOne(GoogleIntegration, {
                    profiles: [profileStub]
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

                await expect(service.patchAll(userStub.id, [googleCalendarIntegrationsMock])).rejectedWith(
                    NotAnOwnerException
                );

                expect(googleCalendarIntegrationRepositoryStub.find.called).true;
                expect(googleCalendarIntegrationRepositoryStub.save.called).false;
            });
        });

    });
});
