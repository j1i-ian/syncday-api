import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppleCalDAVIntegrationScheduledEvent } from '@entities/integrations/apple/apple-caldav-integration-scheduled-event.entity';
import { AppleIntegrationsSchedulesService } from './apple-integrations-schedules.service';

describe('AppleIntegrationsSchedulesService', () => {
    let service: AppleIntegrationsSchedulesService;

    let appleCalDAVIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVIntegrationScheduledEvent>>;

    beforeEach(async () => {

        appleCalDAVIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVIntegrationScheduledEvent>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppleIntegrationsSchedulesService,
                {
                    provide: getRepositoryToken(AppleCalDAVIntegrationScheduledEvent),
                    useValue: appleCalDAVIntegrationScheduleRepositoryStub
                }
            ]
        }).compile();

        service = module.get<AppleIntegrationsSchedulesService>(AppleIntegrationsSchedulesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be got a scheduled event repository', () => {
        const scheduledEventRepository = service.getInjectedRepository();

        expect(scheduledEventRepository).ok;
    });
});
