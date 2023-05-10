import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '@entity/events/event.entity';
import { User } from '@entity/users/user.entity';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { UserOwnCriteria } from '@criteria/user-own.criteria';
import { TestMockUtil } from '@test/test-mock-util';

describe('UserOwnCriteria', () => {
    let criteria: UserOwnCriteria;

    let module: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;

    before(async () => {
        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                UserOwnCriteria,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(Event),
                    useValue: eventRepositoryStub
                }
            ]
        }).compile();

        criteria = module.get<UserOwnCriteria>(UserOwnCriteria);
    });

    it('should be defined', () => {
        expect(criteria).ok;
    });

    describe('Test criteria', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            eventRepositoryStub.findOne.reset();

            serviceSandbox.restore();
        });

        it('should be filtered by user id', async () => {
            const userMock = stubOne(User);
            const eventStub = stubOne(Event);

            const getFindOneOptionStub = serviceSandbox.stub(criteria, 'getFindOneOption');

            eventRepositoryStub.findOne.resolves(eventStub);

            const filtered = await criteria.filter(Event, userMock.id, eventStub.id);

            expect(filtered).ok;
            expect(eventRepositoryStub.findOne.called).true;
            expect(getFindOneOptionStub.called).true;
        });
    });

    describe('Test Getting FindOneOption', function () {
        [
            {
                ResourceEntityClass: Event
            },
            {
                ResourceEntityClass: EventGroup
            }
        ].forEach(({ ResourceEntityClass }) => {
            it('should be got findOption for ' + ResourceEntityClass.name, () => {
                const userMock = stubOne(User);
                const eventStub = stubOne(Event);

                const findOneOption = criteria.getFindOneOption(
                    ResourceEntityClass,
                    userMock.id,
                    eventStub.id
                );

                expect(findOneOption).ok;
            });
        });
    });
});
