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
            clusterStub.setex.reset();
            clusterStub.get.reset();
            utilServiceStub.generateRandomNumberString.reset();
            integrationsServiceStub.sendMessage.reset();
            syncdayRedisServiceStub.getEmailVerificationKey.reset();
        });

        describe('Test create verification test', () => {
            const languageMock = Language.ENGLISH;
            const fakeEmailKey = 'local:verifications:email:alan@sync.day';

            it('should be created email verification when cluster saving is success', async () => {
                const emailMock = TestMockUtil.faker.internet.email();

                syncdayRedisServiceStub.getEmailVerificationKey.returns(fakeEmailKey);
                utilServiceStub.generateRandomNumberString.returns('0123');
                integrationsServiceStub.sendMessage.resolves(true);
                clusterStub.setex.resolves('OK');

                const result = await service.createVerification(emailMock, languageMock);

                expect(syncdayRedisServiceStub.getEmailVerificationKey.called).true;
                expect(utilServiceStub.generateRandomNumberString.called).true;
                expect(integrationsServiceStub.sendMessage.called).true;
                expect(clusterStub.setex.called).true;

                expect(result).true;
            });

            it('should be not created email verification when cluster saving is failed', async () => {
                const emailMock = TestMockUtil.faker.internet.email();

                syncdayRedisServiceStub.getEmailVerificationKey.returns(fakeEmailKey);

                utilServiceStub.generateRandomNumberString.returns('0123');
                integrationsServiceStub.sendMessage.resolves(true);

                const result = await service.createVerification(emailMock, languageMock);

                expect(syncdayRedisServiceStub.getEmailVerificationKey.called).true;
                expect(utilServiceStub.generateRandomNumberString.called).true;
                expect(integrationsServiceStub.sendMessage.called).true;
                expect(clusterStub.setex.called).true;

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

    describe('Test phone verification', () => {
        afterEach(() => {
            clusterStub.setex.reset();
            clusterStub.get.reset();
            utilServiceStub.generateRandomNumberString.reset();
            integrationsServiceStub.sendMessage.reset();
            syncdayRedisServiceStub.getPhoneVerificationKey.reset();
        });

        describe('Test create verification test', () => {
            const languageMock = Language.ENGLISH;
            const fakePhoneKey = 'local:verifications:phone:+821012345678';

            it('should be created phone verification when cluster saving is success', async () => {
                const phoneMock = TestMockUtil.faker.phone.number();

                syncdayRedisServiceStub.getPhoneVerificationKey.returns(fakePhoneKey);
                utilServiceStub.generateRandomNumberString.returns('0123');
                integrationsServiceStub.sendMessage.resolves(true);
                clusterStub.setex.resolves('OK');

                const result = await service.createVerificationWithPhoneNumber(phoneMock, languageMock);

                expect(syncdayRedisServiceStub.getPhoneVerificationKey.called).true;
                expect(utilServiceStub.generateRandomNumberString.called).true;
                expect(integrationsServiceStub.sendMessage.called).true;
                expect(clusterStub.setex.called).true;

                expect(result).true;
            });

            it('should be not created phone verification when cluster saving is failed', async () => {
                const phoneMock = TestMockUtil.faker.phone.number();

                syncdayRedisServiceStub.getPhoneVerificationKey.returns(fakePhoneKey);

                utilServiceStub.generateRandomNumberString.returns('0123');
                integrationsServiceStub.sendMessage.resolves(true);
                clusterStub.setex.resolves();

                const result = await service.createVerificationWithPhoneNumber(phoneMock, languageMock);

                expect(syncdayRedisServiceStub.getPhoneVerificationKey.called).true;
                expect(utilServiceStub.generateRandomNumberString.called).true;
                expect(integrationsServiceStub.sendMessage.called).true;
                expect(clusterStub.setex.called).true;

                expect(result).false;
            });
        });

        describe('Test retrieving phone verification status', () => {
            afterEach(() => {
                syncdayRedisServiceStub.getPhoneVerification.reset();
                syncdayRedisServiceStub.getPhoneVerificationStatus.reset();
            });

            it('should be got true when phone verification status is true', async () => {
                const phoneMock = TestMockUtil.faker.phone.number();

                const verificationStub = stubOne(Verification);

                syncdayRedisServiceStub.getPhoneVerification.resolves(verificationStub);
                syncdayRedisServiceStub.getPhoneVerificationStatus.resolves(true);

                const result = await service.isVerifiedPhone(phoneMock);

                expect(syncdayRedisServiceStub.getPhoneVerification.called).true;
                expect(syncdayRedisServiceStub.getPhoneVerificationStatus.called).true;

                expect(result).true;
            });

            it('should be got false when phone verification status is false', async () => {
                const phoneMock = TestMockUtil.faker.phone.number();

                const verificationStub = stubOne(Verification);

                syncdayRedisServiceStub.getPhoneVerification.resolves(verificationStub);
                syncdayRedisServiceStub.getPhoneVerificationStatus.resolves(false);

                const result = await service.isVerifiedPhone(phoneMock);

                expect(syncdayRedisServiceStub.getPhoneVerification.called).true;
                expect(syncdayRedisServiceStub.getPhoneVerificationStatus.called).true;

                expect(result).false;
            });
        });
    });
});
