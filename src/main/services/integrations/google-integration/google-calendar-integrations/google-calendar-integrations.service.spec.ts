import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { IntegrationUtilsService } from '@services/util/integration-utils/integration-utils.service';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleCalendarIntegrationsService } from './google-calendar-integrations.service';

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
        afterEach(() => {
            googleCalendarIntegrationRepositoryStub.find.reset();
            googleCalendarIntegrationRepositoryStub.save.reset();
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
