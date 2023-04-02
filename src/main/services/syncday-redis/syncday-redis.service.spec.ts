/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { Cluster, RedisKey } from 'ioredis';
import { TestMockUtil } from '../../../test/test-mock-util';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { SyncdayRedisService } from './syncday-redis.service';
import { RedisStores } from './redis-stores.enum';

const testMockUtil = new TestMockUtil();

describe('Redis Service Test', () => {
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

    it('service init test', () => {
        expect(service).ok;
    });

    describe('Test Email Verification', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        it('should be got email verification', () => {
            const emailMock = testMockUtil.getFaker().internet.email();

            const verificationStub = testMockUtil.getVerificationMock();
            const verificationStubString = JSON.stringify(verificationStub);

            serviceSandbox.stub(service, 'getEmailVerificationKey').returns(emailMock as RedisKey);
            clusterStub.get.resolves(verificationStubString);

            const verification = service.getEmailVerification(emailMock);
            expect(verification).ok;
        });

        it('coverage test', () => {
            const emailMock = testMockUtil.getFaker().internet.email();

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:something:redis:key');

            const result = service.getEmailVerificationKey(emailMock);

            expect(result).ok;
        });

        it('coverage test', () => {
            const result = (service as any)['getRedisKey'](RedisStores.TOKENS_USERS, [
                'test',
                'test2'
            ]);

            expect(result).ok;
        });
    });
});
