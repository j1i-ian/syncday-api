import { Test, TestingModule } from '@nestjs/testing';
import { Cluster } from 'ioredis';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { UtilService } from '@services/util/util.service';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';

describe('Integrations Redis Repository Spec', () => {
    let repository: IntegrationsRedisRepository;

    let clusterStub: sinon.SinonStubbedInstance<Cluster>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    beforeEach(async () => {

        clusterStub = sinon.createStubInstance(Cluster);
        utilServiceStub = sinon.createStubInstance(UtilService);
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntegrationsRedisRepository,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: getClusterToken(DEFAULT_CLUSTER_NAMESPACE),
                    useValue: clusterStub
                }
            ]
        }).compile();

        repository = module.get<IntegrationsRedisRepository>(IntegrationsRedisRepository);
    });

    it('should be defiend', () => {
        expect(repository).ok;
    });

});
