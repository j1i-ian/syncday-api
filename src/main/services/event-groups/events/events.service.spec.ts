import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventDetail } from '@entity/events/event-detail.entity';
import { EventsService } from './events.service';

describe('EventsService', () => {
    let service: EventsService;
    let eventDetailRepositoryStub: sinon.SinonStubbedInstance<Repository<EventDetail>>;

    beforeEach(async () => {
        eventDetailRepositoryStub = sinon.createStubInstance<Repository<EventDetail>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventsService,
                {
                    provide: getRepositoryToken(EventDetail),
                    useValue: eventDetailRepositoryStub
                }
            ]
        }).compile();

        service = module.get<EventsService>(EventsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
