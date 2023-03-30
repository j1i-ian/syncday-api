import { Test, TestingModule } from '@nestjs/testing';
import { EventGroupsService } from './event-groups.service';

describe('EventGroupsService', () => {
    let service: EventGroupsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [EventGroupsService]
        }).compile();

        service = module.get<EventGroupsService>(EventGroupsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
