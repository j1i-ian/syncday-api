import { Test, TestingModule } from '@nestjs/testing';
import { GoogleCalendarEventListService } from './google-calendar-event-list.service';

describe('GoogleCalendarEventListService', () => {
    let service: GoogleCalendarEventListService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleCalendarEventListService]
        }).compile();

        service = await module.resolve<GoogleCalendarEventListService>(GoogleCalendarEventListService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
