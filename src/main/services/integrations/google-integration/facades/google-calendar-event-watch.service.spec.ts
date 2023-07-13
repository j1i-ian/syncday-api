import { Test, TestingModule } from '@nestjs/testing';
import { GoogleCalendarEventWatchService } from './google-calendar-event-watch.service';

describe('GoogleCalendarEventWatchService', () => {
    let service: GoogleCalendarEventWatchService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleCalendarEventWatchService]
        }).compile();

        service = await module.resolve<GoogleCalendarEventWatchService>(GoogleCalendarEventWatchService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
