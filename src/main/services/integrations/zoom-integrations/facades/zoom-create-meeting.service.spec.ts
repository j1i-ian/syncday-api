import { Test, TestingModule } from '@nestjs/testing';
import { ZoomCreateConferenceLinkService } from './zoom-create-meeting.service';

describe('ZoomCreateConferenceLinkService', () => {
    let service: ZoomCreateConferenceLinkService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ZoomCreateConferenceLinkService]
        }).compile();

        service = module.get<ZoomCreateConferenceLinkService>(ZoomCreateConferenceLinkService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
