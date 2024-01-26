import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '@entities/events/event.entity';
import { EventGroup } from '@entities/events/event-group.entity';
import { Team } from '@entities/teams/team.entity';
import { TeamOwnCriteria } from '@criteria/team-own.criteria';
import { TestMockUtil } from '@test/test-mock-util';

describe('TeamOwnCriteria', () => {
    let criteria: TeamOwnCriteria;

    let module: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;

    before(async () => {
        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                TeamOwnCriteria,
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

        criteria = module.get<TeamOwnCriteria>(TeamOwnCriteria);
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

        it('should be filtered by team id', async () => {
            const teamMock = stubOne(Team);
            const eventStub = stubOne(Event);

            const getFindOneOptionStub = serviceSandbox.stub(criteria, 'getFindOneOption');

            eventRepositoryStub.findOne.resolves(eventStub);

            const filtered = await criteria.filter(Event, teamMock.id, eventStub.id);

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
                const teamMock = stubOne(Team);
                const eventStub = stubOne(Event);

                const findOneOption = criteria.getFindOneOption(
                    ResourceEntityClass,
                    teamMock.id,
                    eventStub.id
                );

                expect(findOneOption).ok;
            });
        });
    });
});
