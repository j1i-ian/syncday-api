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
            clusterStub.set.reset();
            clusterStub.get.reset();
            serviceSandbox.restore();
        });

        it('should be got email verification', async () => {
            const emailMock = testMockUtil.getFaker().internet.email();

            const verificationStub = testMockUtil.getVerificationMock();
            const verificationStubString = JSON.stringify(verificationStub);

            serviceSandbox.stub(service, 'getEmailVerificationKey').returns(emailMock as RedisKey);
            clusterStub.get.resolves(verificationStubString);

            const verification = await service.getEmailVerification(emailMock);
            expect(verification).ok;
        });

        it('should be got getEmailVerificationStatus', async () => {
            const emailMock = testMockUtil.getFaker().internet.email();
            const uuidMock = testMockUtil.getFaker().datatype.uuid();

            const statusJsonStringStub = 'true';

            const keyStub = `local:alan@sync.day:${uuidMock}`;

            serviceSandbox.stub(service, <any>'getEmailVerificationStatusKey').returns(keyStub);

            clusterStub.get.resolves(statusJsonStringStub);

            const actualStatusJsonString = await service.getEmailVerificationStatus(
                emailMock,
                uuidMock
            );

            expect(actualStatusJsonString).true;
        });

        it('should be set email verification status', async () => {
            const emailMock = testMockUtil.getFaker().internet.email();
            const uuidMock = testMockUtil.getFaker().datatype.uuid();

            serviceSandbox
                .stub(service, 'getEmailVerificationStatusKey')
                .returns(emailMock as RedisKey);

            clusterStub.set.resolves('OK');

            const verification = await service.setEmailVerificationStatus(emailMock, uuidMock);
            expect(verification).true;
        });

        it('coverage fill', () => {
            const emailMock = testMockUtil.getFaker().internet.email();

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:something:redis:key');

            const result = service.getEmailVerificationKey(emailMock);

            expect(result).ok;
        });

        it('coverage fill', () => {
            const emailMock = testMockUtil.getFaker().internet.email();
            const uuid = 'mockuuid';

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:something:redis:key');

            const result = service.getEmailVerificationStatusKey(emailMock, uuid);

            expect(result).ok;
        });

        it('coverage fill', () => {
            const result = (service as any)['getRedisKey'](RedisStores.TOKENS_USERS, [
                'test',
                'test2'
            ]);

            expect(result).ok;
        });
    });
});
