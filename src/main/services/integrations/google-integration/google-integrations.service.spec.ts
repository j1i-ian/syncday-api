import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { GoogleIntegrationSchedulesService } from '@services/integrations/google-integration/google-integration-schedules/google-integration-schedules.service';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';

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
});


