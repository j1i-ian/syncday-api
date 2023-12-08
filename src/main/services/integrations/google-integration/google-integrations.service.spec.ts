import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { OAuth2Setting } from '@core/interfaces/auth/oauth2-setting.interface';
import { AppConfigService } from '@config/app-config.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { GoogleIntegrationSchedulesService } from '@services/integrations/google-integration/google-integration-schedules/google-integration-schedules.service';
import { GoogleConferenceLinkIntegrationService } from '@services/integrations/google-integration/google-conference-link-integration/google-conference-link-integration.service';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { GoogleIntegrationSchedule } from '@entity/integrations/google/google-integration-schedule.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { CalendarCreateOption } from '@app/interfaces/integrations/calendar-create-option.interface';
import { TestMockUtil } from '@test/test-mock-util';

const testMockUtil = new TestMockUtil();

describe('GoogleIntegrationsService', () => {
    let module: TestingModule;
    let service: GoogleIntegrationsService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;

    let googleConverterServiceStub: sinon.SinonStubbedInstance<GoogleConverterService>;
    let googleCalendarIntegrationsServiceStub: sinon.SinonStubbedInstance<GoogleCalendarIntegrationsService>;
    let googleConferenceLinkIntegrationServiceStub: sinon.SinonStubbedInstance<GoogleConferenceLinkIntegrationService>;
    let googleIntegrationSchedulesServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationSchedulesService>;

    let googleIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegration>>;
    let integrationsRedisRepositoryStub: sinon.SinonStubbedInstance<IntegrationsRedisRepository>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        googleConverterServiceStub = sinon.createStubInstance(GoogleConverterService);
        googleCalendarIntegrationsServiceStub = sinon.createStubInstance(GoogleCalendarIntegrationsService);
        googleConferenceLinkIntegrationServiceStub = sinon.createStubInstance(GoogleConferenceLinkIntegrationService);
        googleIntegrationSchedulesServiceStub = sinon.createStubInstance(GoogleIntegrationSchedulesService);

        googleIntegrationRepositoryStub =
            sinon.createStubInstance<Repository<GoogleIntegration>>(Repository);

        integrationsRedisRepositoryStub = sinon.createStubInstance<IntegrationsRedisRepository>(IntegrationsRedisRepository);

        module = await Test.createTestingModule({
            providers: [
                GoogleIntegrationsService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: IntegrationsRedisRepository,
                    useValue: integrationsRedisRepositoryStub
                },
                {
                    provide: GoogleConverterService,
                    useValue: googleConverterServiceStub
                },
                {
                    provide: GoogleCalendarIntegrationsService,
                    useValue: googleCalendarIntegrationsServiceStub
                },
                {
                    provide: GoogleConferenceLinkIntegrationService,
                    useValue: googleConferenceLinkIntegrationServiceStub
                },
                {
                    provide: GoogleIntegrationSchedulesService,
                    useValue: googleIntegrationSchedulesServiceStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(GoogleIntegration),
                    useValue: googleIntegrationRepositoryStub
                }
            ]
        }).compile();

        service = module.get<GoogleIntegrationsService>(GoogleIntegrationsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be got redirect URI for oauth 2', () => {
        const OAuth2TokenResponseMock = testMockUtil.getSyncdayOAuth2TokenResponseMock();

        const serviceSandbox = sinon.createSandbox();

        const getGoogleOAuth2SettingStub = serviceSandbox.stub(AppConfigService, 'getOAuth2Setting').returns({
            oauth2SuccessRedirectURI: 'https://fakeSignInOrUpRedirectURI.com'
        } as OAuth2Setting);

        const generatedURI = service.generateOAuth2RedirectURI(
            OAuth2TokenResponseMock
        );

        expect(generatedURI).ok;
        expect(getGoogleOAuth2SettingStub.called).true;

        serviceSandbox.restore();
    });

    describe('Test Count Google Integration', () => {

        beforeEach(() => {
            googleIntegrationRepositoryStub.countBy.resolves(1);
        });

        afterEach(() => {
            googleIntegrationRepositoryStub.countBy.reset();
        });

        it('should be counted integration length by condition', async () => {

            const profileIdMock = stubOne(Profile).id;

            const counted = await service.count({
                profileId: profileIdMock
            });

            expect(counted).greaterThan(0);
        });
    });

    describe('Test Creating Google Calendar', () => {

        afterEach(() => {
            integrationsRedisRepositoryStub.setGoogleCalendarSubscriptionStatus.reset();
            googleIntegrationRepositoryStub.save.reset();
            googleIntegrationSchedulesServiceStub._saveAll.reset();
            googleConverterServiceStub.convertToGoogleIntegrationSchedules.reset();
            googleCalendarIntegrationsServiceStub.subscribeCalendar.reset();
        });

        [
            {
                description: 'should be created google integration where email is patched from google user',
                profileMock: stubOne(Profile),
                teamSettingMock: stubOne(TeamSetting),
                userSettingMock: stubOne(UserSetting),
                googleCalendarIntegrationsMocks: [
                    stubOne(GoogleCalendarIntegration, {
                        primary: true
                    }),
                    ...stub(GoogleCalendarIntegration, 3, {
                        primary: false
                    })
                ],
                googleIntegrationBodyMock: testMockUtil.getGoogleIntegrationBodyMock(),
                googleOAuthTokenMock: testMockUtil.getGoogleOAuthTokenMock(),
                googleSchedules: stub(GoogleIntegrationSchedule),
                options: undefined,
                expectedOutboundCalendarCount: 1
            },
            {
                description: 'should be created first google integration with outbound setting',
                profileMock: stubOne(Profile),
                teamSettingMock: stubOne(TeamSetting),
                userSettingMock: stubOne(UserSetting),
                googleCalendarIntegrationsMocks: stub(GoogleCalendarIntegration, 3, {
                    setting: {
                        conflictCheck: true,
                        outboundWriteSync: true,
                        inboundDecliningSync: false
                    },
                    primary: true
                }),
                googleIntegrationBodyMock: testMockUtil.getGoogleIntegrationBodyMock(),
                googleOAuthTokenMock: testMockUtil.getGoogleOAuthTokenMock(),
                googleSchedules: stub(GoogleIntegrationSchedule),
                options: {
                    isFirstIntegration: true
                } as CalendarCreateOption,
                expectedOutboundCalendarCount: 1
            },
            {
                description: 'should be created second google integration without outbound setting',
                profileMock: stubOne(Profile),
                teamSettingMock: stubOne(TeamSetting),
                userSettingMock: stubOne(UserSetting),
                googleCalendarIntegrationsMocks: stub(GoogleCalendarIntegration, 3, {
                    setting: {
                        conflictCheck: true,
                        outboundWriteSync: true,
                        inboundDecliningSync: false
                    },
                    primary: true
                }),
                googleIntegrationBodyMock: testMockUtil.getGoogleIntegrationBodyMock(),
                googleOAuthTokenMock: testMockUtil.getGoogleOAuthTokenMock(),
                googleSchedules: stub(GoogleIntegrationSchedule),
                options: {
                    isFirstIntegration: false
                } as CalendarCreateOption,
                expectedOutboundCalendarCount: 0
            }
        ].forEach(function({
            description,
            profileMock,
            teamSettingMock,
            userSettingMock,
            googleCalendarIntegrationsMocks,
            googleIntegrationBodyMock,
            googleOAuthTokenMock,
            googleSchedules,
            options,
            expectedOutboundCalendarCount
        }) {

            beforeEach(() => {

                googleIntegrationRepositoryStub.save.callsFake((entity) => Promise.resolve(entity as GoogleIntegration));
                googleConverterServiceStub.convertToGoogleIntegrationSchedules.returns(googleSchedules);
            });

            it(description, async () => {

                const createdGoogleIntegration = await service._create(
                    datasourceMock as EntityManager,
                    profileMock,
                    teamSettingMock,
                    userSettingMock,
                    googleOAuthTokenMock,
                    googleCalendarIntegrationsMocks,
                    googleIntegrationBodyMock,
                    options
                );

                expect(createdGoogleIntegration).ok;

                expect(googleIntegrationRepositoryStub.save.called).true;
                expect(integrationsRedisRepositoryStub.setGoogleCalendarSubscriptionStatus.called).true;
                expect(googleConverterServiceStub.convertToGoogleIntegrationSchedules.called).true;
                expect(googleIntegrationSchedulesServiceStub._saveAll.called).true;
                expect(googleCalendarIntegrationsServiceStub.subscribeCalendar.called).true;

                const outboundCalendars = createdGoogleIntegration.googleCalendarIntegrations.filter((_googleCalendar) => _googleCalendar.setting.outboundWriteSync);

                expect(outboundCalendars.length).equals(expectedOutboundCalendarCount);
            });
        });

    });
});
