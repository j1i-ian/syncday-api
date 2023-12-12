import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { IntegrationsValidator } from '@services/integrations/integrations.validator';

describe('Integrations Validator Spec', () => {
    let service: IntegrationsValidator;

    let loggerStub: sinon.SinonStub;

    beforeEach(async () => {
        loggerStub = sinon.stub({
            debug: () => {},
            info: () => {},
            error: () => {}
        } as unknown as Logger) as unknown as sinon.SinonStub;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntegrationsValidator,
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                }
            ]
        }).compile();

        service = module.get<IntegrationsValidator>(IntegrationsValidator);
    });

    it('should be defiend', () => {
        expect(service).ok;
    });

});
