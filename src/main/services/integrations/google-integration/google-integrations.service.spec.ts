import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { GoogleIntegrationSchedulesService } from '@services/integrations/google-integration/google-integration-schedules/google-integration-schedules.service';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { User } from '@entity/users/user.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { TestMockUtil } from '@test/test-mock-util';

const testMockUtil = new TestMockUtil();

describe('GoogleIntegrationsService', () => {
    let module: TestingModule;
    let service: GoogleIntegrationsService;

    let googleConverterServiceStub: sinon.SinonStubbedInstance<GoogleConverterService>;
    let googleCalendarIntegrationsServiceStub: sinon.SinonStubbedInstance<GoogleCalendarIntegrationsService>;
    let googleIntegrationSchedulesServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationSchedulesService>;

    let gogoleIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegration>>;
    let integrationsRedisRepositoryStub: sinon.SinonStubbedInstance<IntegrationsRedisRepository>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    before(async () => {
        googleConverterServiceStub = sinon.createStubInstance(GoogleConverterService);
        googleCalendarIntegrationsServiceStub = sinon.createStubInstance(GoogleCalendarIntegrationsService);
        googleIntegrationSchedulesServiceStub = sinon.createStubInstance(GoogleIntegrationSchedulesService);

        gogoleIntegrationRepositoryStub =
            sinon.createStubInstance<Repository<GoogleIntegration>>(Repository);

        integrationsRedisRepositoryStub = sinon.createStubInstance<IntegrationsRedisRepository>(IntegrationsRedisRepository);

        module = await Test.createTestingModule({
            providers: [
                GoogleIntegrationsService,
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
                    provide: GoogleIntegrationSchedulesService,
                    useValue: googleIntegrationSchedulesServiceStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(GoogleIntegration),
                    useValue: gogoleIntegrationRepositoryStub
                }
            ]
        }).compile();

        service = module.get<GoogleIntegrationsService>(GoogleIntegrationsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Creating Google Calendar', () => {

        afterEach(() => {
            integrationsRedisRepositoryStub.setGoogleCalendarSubscriptionStatus.reset();
            gogoleIntegrationRepositoryStub.save.reset();
            googleIntegrationSchedulesServiceStub._saveAll.reset();
            googleConverterServiceStub.convertToGoogleIntegrationSchedules.reset();
            googleCalendarIntegrationsServiceStub.subscribeCalendar.reset();
        });

        it('should be created google integration where email is patched from google user', async () => {

            const userMock = stubOne(User, {
                email: 'alan@sync.day'
            });
            const userSettingMock = stubOne(UserSetting);
            const googleCalendarIntegrationsMock = stub(GoogleCalendarIntegration);
            googleCalendarIntegrationsMock[0].primary = true;

            const googleIntegrationBodyMock = testMockUtil.getGoogleIntegrationBodyMock();
            const googleOAuthTokenMock = testMockUtil.getGoogleOAuthTokenMock();

            const googleIntegrationStub = stubOne(GoogleIntegration, {
                email: googleIntegrationBodyMock.googleUserEmail,
                googleCalendarIntegrations: googleCalendarIntegrationsMock
            });

            const googleSchedules = stub(GoogleIntegrationSchedule);

            gogoleIntegrationRepositoryStub.save.resolves(googleIntegrationStub);
            googleConverterServiceStub.convertToGoogleIntegrationSchedules.returns(googleSchedules);

            const createdGoogleIntegration = await service._create(
                datasourceMock as EntityManager,
                userMock,
                userSettingMock,
                googleOAuthTokenMock,
                googleCalendarIntegrationsMock,
                googleIntegrationBodyMock
            );

            expect(createdGoogleIntegration).ok;
            expect(createdGoogleIntegration.email).not.equals(userMock.email);
            expect(createdGoogleIntegration.email).equals(googleIntegrationBodyMock.googleUserEmail);

            expect(gogoleIntegrationRepositoryStub.save.called).true;
            expect(integrationsRedisRepositoryStub.setGoogleCalendarSubscriptionStatus.called).true;
            expect(googleConverterServiceStub.convertToGoogleIntegrationSchedules.called).true;
            expect(googleIntegrationSchedulesServiceStub._saveAll.called).true;
            expect(googleCalendarIntegrationsServiceStub.subscribeCalendar.called).true;
        });
    });
});
