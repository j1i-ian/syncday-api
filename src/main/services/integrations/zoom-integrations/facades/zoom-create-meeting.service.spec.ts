import { Test, TestingModule } from '@nestjs/testing';
import { ZoomCreateMeetingService } from './zoom-create-meeting.service';

describe('ZoomCreateMeetingService', () => {
    let service: ZoomCreateMeetingService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ZoomCreateMeetingService]
        }).compile();

        service = module.get<ZoomCreateMeetingService>(ZoomCreateMeetingService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
