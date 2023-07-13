import { Test, TestingModule } from '@nestjs/testing';
import { GoogleIntegrationSchedulesService } from './google-integration-schedules.service';

describe('GoogleIntegrationSchedulesService', () => {
    let service: GoogleIntegrationSchedulesService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleIntegrationSchedulesService]
        }).compile();

        service = module.get<GoogleIntegrationSchedulesService>(GoogleIntegrationSchedulesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
