import { Test, TestingModule } from '@nestjs/testing';
import { Cluster, Pipeline } from 'ioredis';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { TeamRedisRepository } from '@services/team/team.redis-repository';
import { Team } from '@entity/teams/team.entity';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';

describe('TeamRedisRepository', () => {
    let redisRepository: TeamRedisRepository;

    let clusterStub: sinon.SinonStubbedInstance<Cluster>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    before(async () => {
        clusterStub = sinon.createStubInstance(Cluster);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: getClusterToken(DEFAULT_CLUSTER_NAMESPACE),
                    useValue: clusterStub
                },
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                TeamRedisRepository
            ]
        }).compile();

        redisRepository = module.get<TeamRedisRepository>(TeamRedisRepository);
    });

    it('should be defined', () => {
        expect(redisRepository).ok;
    });

    describe('Test Member count search', () => {

        let serviceSandbox: sinon.SinonSandbox;
        let pipelineStub: sinon.SinonStubbedInstance<Pipeline>;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            pipelineStub = serviceSandbox.createStubInstance(Pipeline);

            clusterStub.pipeline.returns(pipelineStub);
        });

        afterEach(() => {
            syncdayRedisServiceStub.getMemberCountKey.reset();
            clusterStub.get.reset();
            clusterStub.exec.reset();
        });

        it('should be initialized the member count as 1', async () => {

            const teamMocks = stub(Team);

            pipelineStub.exec.resolves([[null, 5]] as Array<[error: Error | null, result: number]>);

            const results = await redisRepository.searchMemberCount(teamMocks.map((_team) => _team.uuid));

            expect(syncdayRedisServiceStub.getMemberCountKey.called).true;
            expect(clusterStub.pipeline.called).true;
            expect(pipelineStub.get.called).true;
            expect(pipelineStub.exec.called).true;

            expect(results.length).greaterThan(0);
        });
    });

    describe('Test Member count initializing', () => {

        afterEach(() => {
            syncdayRedisServiceStub.getMemberCountKey.reset();
            clusterStub.set.reset();
        });

        it('should be initialized the member count as 1', async () => {

            const teamMock = stubOne(Team);

            clusterStub.set.resolves();

            await redisRepository.initializeMemberCount(teamMock.uuid);

            const initNumber = clusterStub.set.getCall(0).args[1];

            expect(initNumber).equals(1);

            expect(syncdayRedisServiceStub.getMemberCountKey.called).true;
            expect(clusterStub.set.called).true;
        });
    });

    describe('Test Member count getting', () => {

        afterEach(() => {
            syncdayRedisServiceStub.getMemberCountKey.reset();
            clusterStub.get.reset();
        });

        it('should be initialized the member count as 1', async () => {

            const teamMock = stubOne(Team);
            const teamMemberStub = '5';

            const initialized = await redisRepository.getMemberCount(teamMock.uuid);

            clusterStub.get.resolves(teamMemberStub);

            const result = await redisRepository.getMemberCount(teamMock.uuid);

            expect(initialized).ok;
            expect(result).greaterThan(0);

            expect(syncdayRedisServiceStub.getMemberCountKey.called).true;
            expect(clusterStub.get.called).true;
        });
    });

    describe('Test Member incremenet', () => {

        afterEach(() => {
            syncdayRedisServiceStub.getMemberCountKey.reset();
            clusterStub.incrby.reset();
        });

        it('should be incremented the member count', async () => {

            const teamMock = stubOne(Team);

            clusterStub.incrby.resolves(6);

            const incrementals = await redisRepository.incrementMemberCount(teamMock.uuid, 5);

            expect(incrementals).ok;
            expect(incrementals).greaterThan(0);

            expect(syncdayRedisServiceStub.getMemberCountKey.called).true;
            expect(clusterStub.incrby.called).true;
        });
    });

    describe('Test Member decrement', () => {

        afterEach(() => {
            syncdayRedisServiceStub.getMemberCountKey.reset();
            clusterStub.incrby.reset();
        });

        it('should be decremented the member count', async () => {

            const teamMock = stubOne(Team);

            clusterStub.decrby.resolves(3);

            const incrementals = await redisRepository.decrementMemberCount(teamMock.uuid, 2);

            expect(incrementals).ok;
            expect(incrementals).greaterThan(0);

            expect(syncdayRedisServiceStub.getMemberCountKey.called).true;
            expect(clusterStub.decrby.called).true;
        });
    });
});
