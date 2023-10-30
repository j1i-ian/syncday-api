import { Test, TestingModule } from '@nestjs/testing';
import { GlobalCalendarIntegrationService } from './global-calendar-integration.service';

describe('GlobalCalendarIntegrationService', () => {
    let service: GlobalCalendarIntegrationService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GlobalCalendarIntegrationService]
        }).compile();

        service = module.get<GlobalCalendarIntegrationService>(GlobalCalendarIntegrationService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
