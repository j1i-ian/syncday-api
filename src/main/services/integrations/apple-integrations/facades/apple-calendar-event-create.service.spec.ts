import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AppleCalendarEventCreateService } from './apple-calendar-event-create.service';

describe('AppleCalendarEventCreateService', () => {
    let service: AppleCalendarEventCreateService;

    let loggerStub: sinon.SinonStubbedInstance<Logger>;


    beforeEach(async () => {
        loggerStub = sinon.createStubInstance(Logger);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppleCalendarEventCreateService,
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                }
            ]
        }).compile();

        service = module.get<AppleCalendarEventCreateService>(AppleCalendarEventCreateService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
