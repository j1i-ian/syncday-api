import { Test, TestingModule } from '@nestjs/testing';
import { GoogleCalendarListService } from './google-calendar-list.service';

describe('GoogleCalendarListService', () => {
    let service: GoogleCalendarListService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleCalendarListService]
        }).compile();

        service = module.get<GoogleCalendarListService>(GoogleCalendarListService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
