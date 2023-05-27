import { Test, TestingModule } from '@nestjs/testing';
import { Cluster } from 'ioredis';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { IntegrationsService } from '@services/integrations/integrations.service';
import { Verification } from '@entity/verifications/verification.entity';
import { Language } from '@app/enums/language.enum';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { TestMockUtil } from '@test/test-mock-util';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
    let service: VerificationService;

    let clusterStub: sinon.SinonStubbedInstance<Cluster>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;
    let integrationsServiceStub: sinon.SinonStubbedInstance<IntegrationsService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    beforeEach(async () => {
        clusterStub = sinon.createStubInstance(Cluster);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        integrationsServiceStub = sinon.createStubInstance(IntegrationsService);
        utilServiceStub = sinon.createStubInstance(UtilService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VerificationService,
                {
                    provide: getClusterToken(DEFAULT_CLUSTER_NAMESPACE),
                    useValue: clusterStub
                },
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                {
                    provide: IntegrationsService,
                    useValue: integrationsServiceStub
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                }
            ]
        }).compile();

        service = module.get<VerificationService>(VerificationService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test email verification', () => {
        afterEach(() => {
            clusterStub.set.reset();
            clusterStub.get.reset();
            utilServiceStub.generateRandomNumberString.reset();
            integrationsServiceStub.sendVerificationEmail.reset();
            syncdayRedisServiceStub.getEmailVerificationKey.reset();
        });

        describe('Test create verification test', () => {
            const languageMock = Language.ENGLISH;
            const fakeEmailKey = 'local:verifications:email:alan@sync.day';

            it('should be created email verification when cluster saving is success', async () => {
                const emailMock = TestMockUtil.faker.internet.email();

                syncdayRedisServiceStub.getEmailVerificationKey.returns(fakeEmailKey);
                utilServiceStub.generateRandomNumberString.returns('0123');
                integrationsServiceStub.sendVerificationEmail.resolves(true);
                clusterStub.set.resolves('OK');

                const result = await service.createVerification(emailMock, languageMock);

                expect(syncdayRedisServiceStub.getEmailVerificationKey.called).true;
                expect(utilServiceStub.generateRandomNumberString.called).true;
                expect(integrationsServiceStub.sendVerificationEmail.called).true;
                expect(clusterStub.set.called).true;

                expect(result).true;
            });

            it('should be not created email verification when cluster saving is failed', async () => {
                const emailMock = TestMockUtil.faker.internet.email();

                syncdayRedisServiceStub.getEmailVerificationKey.returns(fakeEmailKey);

                utilServiceStub.generateRandomNumberString.returns('0123');
                integrationsServiceStub.sendVerificationEmail.resolves(true);
                clusterStub.set.resolves(null);

                const result = await service.createVerification(emailMock, languageMock);

                expect(syncdayRedisServiceStub.getEmailVerificationKey.called).true;
                expect(utilServiceStub.generateRandomNumberString.called).true;
                expect(integrationsServiceStub.sendVerificationEmail.called).true;
                expect(clusterStub.set.called).true;

                expect(result).false;
            });
        });

        describe('Test retrieving user verification status', () => {
            afterEach(() => {
                syncdayRedisServiceStub.getEmailVerification.reset();
                syncdayRedisServiceStub.getEmailVerificationStatus.reset();
            });

            it('should be got true when user verification status is true', async () => {
                const emailMock = TestMockUtil.faker.internet.email();

                const verificationStub = stubOne(Verification);

                syncdayRedisServiceStub.getEmailVerification.resolves(verificationStub);
                syncdayRedisServiceStub.getEmailVerificationStatus.resolves(true);

                const result = await service.isVerifiedUser(emailMock);

                expect(syncdayRedisServiceStub.getEmailVerification.called).true;
                expect(syncdayRedisServiceStub.getEmailVerificationStatus.called).true;

                expect(result).true;
            });

            it('should be got false when user verification status is false', async () => {
                const emailMock = TestMockUtil.faker.internet.email();

                const verificationStub = stubOne(Verification);

                syncdayRedisServiceStub.getEmailVerification.resolves(verificationStub);
                syncdayRedisServiceStub.getEmailVerificationStatus.resolves(false);

                const result = await service.isVerifiedUser(emailMock);

                expect(syncdayRedisServiceStub.getEmailVerification.called).true;
                expect(syncdayRedisServiceStub.getEmailVerificationStatus.called).true;

                expect(result).false;
            });
        });
    });
});