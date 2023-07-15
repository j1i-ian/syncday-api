import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, of } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { IntegrationUtilsService } from '@services/util/integration-utils/integration-utils.service';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleCalendarEventListService } from '@services/integrations/google-integration/facades/google-calendar-event-list.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleCalendarIntegrationsService } from './google-calendar-integrations.service';

const testMockUtil = new TestMockUtil();

describe('GoogleCalendarIntegrationsService', () => {
    let module: TestingModule;
    let service: GoogleCalendarIntegrationsService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let integrationUtilsServiceStub: sinon.SinonStubbedInstance<IntegrationUtilsService>;
    let googleConverterServiceStub: sinon.SinonStubbedInstance<GoogleConverterService>;
    let integrationsRedisRepositoryStub: sinon.SinonStubbedInstance<IntegrationsRedisRepository>;
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
        integrationUtilsServiceStub = sinon.createStubInstance(IntegrationUtilsService);
        googleConverterServiceStub = sinon.createStubInstance(GoogleConverterService);

        integrationsRedisRepositoryStub = sinon.createStubInstance<IntegrationsRedisRepository>(IntegrationsRedisRepository);

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
            googleIntegrationScheduleRepositoryStub.findBy.reset();
            googleIntegrationScheduleRepositoryStub.save.reset();
            googleIntegrationScheduleRepositoryStub.delete.reset();

            serviceSandbox.restore();
        });

        it('should be searched for calendar items', async () => {

            const googleIntegrationStub = stubOne(GoogleIntegration);
            const oldGoogleIntegrationScheduleStubs = stub(GoogleIntegrationSchedule);
            const newGoogleIntegrationScheduleStubs = stub(GoogleIntegrationSchedule);
            newGoogleIntegrationScheduleStubs[0] = oldGoogleIntegrationScheduleStubs[0];
            newGoogleIntegrationScheduleStubs[1] = oldGoogleIntegrationScheduleStubs[1];
            newGoogleIntegrationScheduleStubs[2] = oldGoogleIntegrationScheduleStubs[2];

            const googleCalendarIntegrationStub = stubOne(GoogleCalendarIntegration, {
                googleIntegration: googleIntegrationStub
            });
            const googleOAuthClientStub = testMockUtil.getGoogleOAuthClientMock();
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock();

            const serviceFindOneStub = serviceSandbox.stub(service, 'findOne');
            serviceFindOneStub.returns(of(googleCalendarIntegrationStub));

            integrationUtilsServiceStub.getGoogleOAuthClient.returns(googleOAuthClientStub);

            const googleCalendarEventListServiceSearchStub = serviceSandbox.stub(GoogleCalendarEventListService.prototype, 'search')
                .resolves(googleScheduleMock);

            googleIntegrationScheduleRepositoryStub.findBy.resolves(oldGoogleIntegrationScheduleStubs);

            googleConverterServiceStub.convertToGoogleIntegrationSchedules.returns(newGoogleIntegrationScheduleStubs);

            await service.synchronizeWithGoogleCalendarEvents(googleCalendarIntegrationStub.uuid);

            expect(serviceFindOneStub.called).true;
            expect(integrationUtilsServiceStub.getGoogleOAuthClient.called).true;
            expect(googleCalendarEventListServiceSearchStub.called).true;
            expect(googleIntegrationScheduleRepositoryStub.findBy.called).true;
            expect(googleConverterServiceStub.convertToGoogleIntegrationSchedules.called).true;
            expect(googleIntegrationScheduleRepositoryStub.save.called).true;
            expect(googleIntegrationScheduleRepositoryStub.delete.called).true;
        });

        it('should be not searched with no calendar items', async () => {
            const googleCalendarUUIDMock = stubOne(GoogleCalendarIntegration).uuid;
            const serviceFindOneStub = serviceSandbox.stub(service, 'findOne');
            serviceFindOneStub.returns(of(null));
            const googleCalendarEventListServiceStub = serviceSandbox.stub(GoogleCalendarEventListService.prototype, 'search');

            await service.synchronizeWithGoogleCalendarEvents(googleCalendarUUIDMock);

            expect(serviceFindOneStub.called).true;
            expect(integrationUtilsServiceStub.getGoogleOAuthClient.called).false;
            expect(googleCalendarEventListServiceStub.called).false;
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
            const userStub = stubOne(User);
            const calendarStubs = stub(GoogleCalendarIntegration, 5, {
                setting: {
                    conflictCheck: false,
                    outboundWriteSync: true,
                    inboundDecliningSync: false
                }
            });

            const googleCalendarIntegrationsMock = calendarStubs[0];

            googleCalendarIntegrationRepositoryStub.find.resolves([calendarStubs[0]] as any);
            googleCalendarIntegrationRepositoryStub.save.resolves([calendarStubs[0]] as any);

            const updateResultMock = TestMockUtil.getTypeormUpdateResultMock();
            googleCalendarIntegrationRepositoryStub.update.resolves(updateResultMock);

            const patchSuccess = await service.patch(userStub.id, [googleCalendarIntegrationsMock]);

            expect(patchSuccess).true;
            expect(googleCalendarIntegrationRepositoryStub.find.called).true;
            expect(googleCalendarIntegrationRepositoryStub.save.called).true;
        });

        it('should be threw error when there is calendar in request array that is not owned of user', async () => {
            const userStub = stubOne(User);
            const calendarStubs = stub(GoogleCalendarIntegration, 1, {
                setting: {
                    conflictCheck: false,
                    outboundWriteSync: true,
                    inboundDecliningSync: false
                }
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
    });
});
