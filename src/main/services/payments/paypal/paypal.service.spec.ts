
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaypalService } from './paypal.service';

describe('PaypalService', () => {
    let service: PaypalService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaypalService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                }
            ]
        }).compile();

        service = module.get<PaypalService>(PaypalService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
