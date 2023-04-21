import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { EventGroupsService } from './event-groups.service';

describe('EventGroupsService', () => {
    let service: EventGroupsService;
    let eventGroupRepositoryStub: sinon.SinonStubbedInstance<Repository<EventGroup>>;

    beforeEach(async () => {
        eventGroupRepositoryStub = sinon.createStubInstance<Repository<EventGroup>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventGroupsService,
                {
                    provide: getRepositoryToken(EventGroup),
                    useValue: eventGroupRepositoryStub
                }
            ]
        }).compile();

        service = module.get<EventGroupsService>(EventGroupsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
