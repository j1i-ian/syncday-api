import { Test, TestingModule } from '@nestjs/testing';
import { GoogleCalendarEventWatchStopService } from './google-calendar-event-watch-stop.service';

describe('GoogleCalendarEventWatchStopService', () => {
    let service: GoogleCalendarEventWatchStopService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleCalendarEventWatchStopService]
        }).compile();

        service = await module.resolve<GoogleCalendarEventWatchStopService>(GoogleCalendarEventWatchStopService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
