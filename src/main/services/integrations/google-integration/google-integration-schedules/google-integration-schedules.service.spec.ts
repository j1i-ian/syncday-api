import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleIntegrationSchedule } from '@entity/integrations/google/google-integration-schedule.entity';
import { GoogleIntegrationSchedulesService } from './google-integration-schedules.service';

describe('GoogleIntegrationSchedulesService', () => {
    let service: GoogleIntegrationSchedulesService;

    let googleIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegrationSchedule>>;

    beforeEach(async () => {

        googleIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegrationSchedule>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleIntegrationSchedulesService,
                {
                    provide: getRepositoryToken(GoogleIntegrationSchedule),
                    useValue: googleIntegrationScheduleRepositoryStub
                }
            ]
        }).compile();

        service = module.get<GoogleIntegrationSchedulesService>(GoogleIntegrationSchedulesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be got a schedule repository', () => {
        const scheduleRepository = service.getInjectedRepository();

        expect(scheduleRepository).ok;
    });
});
