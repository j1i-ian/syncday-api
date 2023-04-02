import { Test, TestingModule } from '@nestjs/testing';
import { Cluster } from 'ioredis';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { SyncdayRedisService } from './syncday-redis.service';

describe('Redis 서비스 테스트', () => {
    let service: SyncdayRedisService;

    let clusterStub: sinon.SinonStubbedInstance<Cluster>;

    beforeEach(async () => {
        clusterStub = sinon.createStubInstance(Cluster);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: getClusterToken(DEFAULT_CLUSTER_NAMESPACE),
                    useValue: clusterStub
                },
                SyncdayRedisService
            ]
        }).compile();

        service = module.get<SyncdayRedisService>(SyncdayRedisService);
    });

    beforeEach(() => {
        clusterStub.get.reset();
        clusterStub.set.reset();
    });

    after(() => {
        sinon.restore();
    });

    it('서비스 초기화 테스트', () => {
        expect(service).ok;
    });
});
