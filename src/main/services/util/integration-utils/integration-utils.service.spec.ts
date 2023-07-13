import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IntegrationUtilsService } from './integration-utils.service';

describe('IntegrationUtilsService', () => {
    let service: IntegrationUtilsService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;

    beforeEach(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntegrationUtilsService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                }
            ]
        }).compile();

        service = module.get<IntegrationUtilsService>(IntegrationUtilsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
