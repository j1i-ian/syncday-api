import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationUtilsService } from './integration-utils.service';

describe('IntegrationUtilsService', () => {
    let service: IntegrationUtilsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [IntegrationUtilsService]
        }).compile();

        service = module.get<IntegrationUtilsService>(IntegrationUtilsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
