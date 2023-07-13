import { Test, TestingModule } from '@nestjs/testing';
import { GoogleCalendarEventCreateService } from './google-calendar-event-create.service';

describe('GoogleCalendarEventCreateService', () => {
    let service: GoogleCalendarEventCreateService;

    let module: TestingModule;

    beforeEach(async () => {
        module = await Test.createTestingModule({
            providers: [GoogleCalendarEventCreateService]
        }).compile();

        service = await module.resolve<GoogleCalendarEventCreateService>(GoogleCalendarEventCreateService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
