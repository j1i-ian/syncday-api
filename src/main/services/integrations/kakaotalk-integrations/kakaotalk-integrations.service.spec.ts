import { Test, TestingModule } from '@nestjs/testing';
import { KakaotalkIntegrationsService } from './kakaotalk-integrations.service';

describe('KakaotalkIntegrationsService', () => {
    let service: KakaotalkIntegrationsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [KakaotalkIntegrationsService]
        }).compile();

        service = module.get<KakaotalkIntegrationsService>(KakaotalkIntegrationsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
