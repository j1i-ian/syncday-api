import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { CoreGoogleConverterService } from '@services/converters/google/core-google-converter.service';
import { TestMockUtil } from '@test/test-mock-util';
import { LogSubscriberService } from './log-subscriber.service';

describe('LogSubscriberService', () => {
    let service: LogSubscriberService;
    let coreGoogleConverterServiceStub: sinon.SinonStubbedInstance<CoreGoogleConverterService>;

    beforeEach(async () => {

        coreGoogleConverterServiceStub = sinon.createStubInstance(CoreGoogleConverterService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LogSubscriberService,
                {
                    provide: CoreGoogleConverterService,
                    useValue: coreGoogleConverterServiceStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: TestMockUtil.getLoggerStub()
                }
            ]
        }).compile();

        service = module.get<LogSubscriberService>(LogSubscriberService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
