import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsValidator } from '@services/integrations/integrations.validator';

describe('Integrations Validator Spec', () => {
    let service: IntegrationsValidator;

    beforeEach(async () => {

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntegrationsValidator
            ]
        }).compile();

        service = module.get<IntegrationsValidator>(IntegrationsValidator);
    });

    it('should be defiend', () => {
        expect(service).ok;
    });

});
