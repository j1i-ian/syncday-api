import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Event } from '../../../../@core/core/entities/events/event.entity';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';
import { EventsService } from './events.service';

describe('EventsService', () => {
    let module: TestingModule;

    let service: EventsService;
    let eventDetailRepositoryStub: sinon.SinonStubbedInstance<Repository<EventDetail>>;

    beforeEach(() => {
        eventDetailRepositoryStub = sinon.createStubInstance<Repository<EventDetail>>(Repository);
        let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;
        let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

        const _getRepository = (EntityClass: new () => any) =>
            module.get(getRepositoryToken(EntityClass));

        const datasourceMock = {
            getRepository: _getRepository,
            transaction: (callback: any) =>
                Promise.resolve(callback({ getRepository: _getRepository }))
        };

        beforeEach(async () => {
            eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);
            syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    EventsService,
                    {
                        provide: getRepositoryToken(EventDetail),
                        useValue: eventDetailRepositoryStub
                    },
                    {
                        provide: getDataSourceToken(),
                        useValue: datasourceMock
                    },
                    {
                        provide: getRepositoryToken(Event),
                        useValue: eventRepositoryStub
                    },
                    {
                        provide: SyncdayRedisService,
                        useValue: syncdayRedisServiceStub
                    }
                ]
            }).compile();

            service = module.get<EventsService>(EventsService);
        });

        it('should be defined', () => {
            expect(service).ok;
        });
    });
});
