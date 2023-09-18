import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { AppleIntegrationsSchedulesService } from './apple-integrations-schedules.service';

describe('AppleIntegrationsSchedulesService', () => {
    let service: AppleIntegrationsSchedulesService;

    let appleCalDAVIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVIntegrationSchedule>>;

    beforeEach(async () => {

        appleCalDAVIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVIntegrationSchedule>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppleIntegrationsSchedulesService,
                {
                    provide: getRepositoryToken(AppleCalDAVIntegrationSchedule),
                    useValue: appleCalDAVIntegrationScheduleRepositoryStub
                }
            ]
        }).compile();

        service = module.get<AppleIntegrationsSchedulesService>(AppleIntegrationsSchedulesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be got a schedule repository', () => {
        const scheduleRepository = service.getInjectedRepository();

        expect(scheduleRepository).ok;
    });
});
