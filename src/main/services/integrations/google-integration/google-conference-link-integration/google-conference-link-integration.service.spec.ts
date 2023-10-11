import { Test, TestingModule } from '@nestjs/testing';
import { GoogleConferenceLinkIntegrationService } from './google-conference-link-integration.service';

describe('GoogleConferenceLinkIntegrationService', () => {
    let service: GoogleConferenceLinkIntegrationService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleConferenceLinkIntegrationService]
        }).compile();

        service = module.get<GoogleConferenceLinkIntegrationService>(GoogleConferenceLinkIntegrationService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
