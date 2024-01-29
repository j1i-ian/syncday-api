import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleIntegrationScheduledEvent } from '@entity/integrations/google/google-integration-scheduled-event.entity';
import { GoogleIntegrationSchedulesService } from './google-integration-schedules.service';

describe('GoogleIntegrationSchedulesService', () => {
    let service: GoogleIntegrationSchedulesService;

    let googleIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegrationScheduledEvent>>;

    beforeEach(async () => {

        googleIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegrationScheduledEvent>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleIntegrationSchedulesService,
                {
                    provide: getRepositoryToken(GoogleIntegrationScheduledEvent),
                    useValue: googleIntegrationScheduleRepositoryStub
                }
            ]
        }).compile();

        service = module.get<GoogleIntegrationSchedulesService>(GoogleIntegrationSchedulesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be got a scheduled event repository', () => {
        const scheduleRepository = service.getInjectedRepository();

        expect(scheduleRepository).ok;
    });
});
