import { Test, TestingModule } from '@nestjs/testing';
import { GoogleCalendarEventPatchService } from './google-calendar-event-patch.service';

describe('GoogleCalendarEventPatchService', () => {
    let service: GoogleCalendarEventPatchService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleCalendarEventPatchService]
        }).compile();

        service = module.get<GoogleCalendarEventPatchService>(GoogleCalendarEventPatchService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
