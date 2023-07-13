import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { EventDetail } from '@entity/events/event-detail.entity';
import { EventDetailsService } from './event-details.service';

describe('EventDetailsService', () => {
    let service: EventDetailsService;

    let eventRedisRepositoryStub: sinon.SinonStubbedInstance<EventsRedisRepository>;
    let eventDetailRepositoryStub: sinon.SinonStubbedInstance<Repository<EventDetail>>;

    before(async () => {

        eventRedisRepositoryStub = sinon.createStubInstance(EventsRedisRepository);
        eventDetailRepositoryStub = sinon.createStubInstance<Repository<EventDetail>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventDetailsService,
                {
                    provide: EventsRedisRepository,
                    useValue: eventRedisRepositoryStub
                },
                {
                    provide: getRepositoryToken(EventDetail),
                    useValue: eventDetailRepositoryStub
                }
            ]
        }).compile();

        service = module.get<EventDetailsService>(EventDetailsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
