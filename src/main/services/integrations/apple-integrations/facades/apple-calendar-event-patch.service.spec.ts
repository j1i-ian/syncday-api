import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AppleCalendarEventPatchService } from './apple-calendar-event-patch.service';

describe('AppleCalendarEventPatchService', () => {
    let service: AppleCalendarEventPatchService;

    let loggerStub: sinon.SinonStubbedInstance<Logger>;

    beforeEach(async () => {
        loggerStub = sinon.createStubInstance(Logger);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppleCalendarEventPatchService,
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                }
            ]
        }).compile();

        service = module.get<AppleCalendarEventPatchService>(AppleCalendarEventPatchService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
