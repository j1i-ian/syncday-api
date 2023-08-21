import { Test, TestingModule } from '@nestjs/testing';
import { Cluster } from 'ioredis';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { IntegrationsService } from '@services/integrations/integrations.service';
import { Verification } from '@entity/verifications/verification.interface';
import { CreateVerificationDto } from '@dto/verifications/create-verification.dto';
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

    describe('Test verification', () => {
        afterEach(() => {
            clusterStub.setex.reset();
            clusterStub.get.reset();
            utilServiceStub.generateRandomNumberString.reset();
            integrationsServiceStub.sendMessage.reset();
            syncdayRedisServiceStub.getEmailVerificationKey.reset();
            syncdayRedisServiceStub.getPhoneVerificationKey.reset();
        });

        describe('Test create verification test', () => {
            [
                {
                    description: 'should be created email verification when cluster saving is success',
                    languageMock: Language.ENGLISH,
                    createVerificationDtoMock: {
                        email: TestMockUtil.faker.internet.email()
                    } as CreateVerificationDto,
                    fakeKeyStubValue: 'local:verifications:email:alan@sync.day',
                    generateRandomNumberStringStubVslue: '0123',
                    uuidStubValue: TestMockUtil.faker.datatype.uuid(),
                    setexStubValue: 'OK' as const,
                    sendMessageStubValue: true,
                    expectedResult: true
                },
                {
                    description: 'should be not created email verification when cluster saving is failed',
                    languageMock: Language.ENGLISH,
                    createVerificationDtoMock: {
                        email: TestMockUtil.faker.internet.email()
                    } as CreateVerificationDto,
                    fakeKeyStubValue: 'local:verifications:email:alan@sync.day',
                    generateRandomNumberStringStubVslue: '0123',
                    uuidStubValue: TestMockUtil.faker.datatype.uuid(),
                    setexStubValue: undefined,
                    sendMessageStubValue: true,
                    expectedResult: false
                },
                {
                    description: 'should be created phoneNumber verification when cluster saving is success',
                    languageMock: Language.ENGLISH,
                    createVerificationDtoMock: {
                        phoneNumber: TestMockUtil.faker.phone.number()
                    } as CreateVerificationDto,
                    fakeKeyStubValue: 'local:verifications:phone:+821012345678',
                    generateRandomNumberStringStubVslue: '0123',
                    uuidStubValue: TestMockUtil.faker.datatype.uuid(),
                    setexStubValue: 'OK' as const,
                    sendMessageStubValue: true,
                    expectedResult: true
                },
                {
                    description: 'should be not created phoneNumber verification when cluster saving is failed',
                    languageMock: Language.ENGLISH,
                    createVerificationDtoMock: {
                        phoneNumber: TestMockUtil.faker.phone.number()
                    } as CreateVerificationDto,
                    fakeKeyStubValue: 'local:verifications:phone:+821012345678',
                    generateRandomNumberStringStubVslue: '0123',
                    uuidStubValue: TestMockUtil.faker.datatype.uuid(),
                    setexStubValue: undefined,
                    sendMessageStubValue: true,
                    expectedResult: false
                }
            ].forEach( function ({
                description,
                languageMock,
                createVerificationDtoMock,
                fakeKeyStubValue,
                generateRandomNumberStringStubVslue,
                uuidStubValue,
                setexStubValue,
                sendMessageStubValue,
                expectedResult
            }) {
                it(description, async () => {

                    utilServiceStub.generateRandomNumberString.returns(generateRandomNumberStringStubVslue);
                    utilServiceStub.generateUUID.returns(uuidStubValue);

                    if (createVerificationDtoMock.email) {
                        syncdayRedisServiceStub.getEmailVerificationKey.returns(fakeKeyStubValue);
                    } else {
                        syncdayRedisServiceStub.getPhoneVerificationKey.returns(fakeKeyStubValue);
                    }

                    integrationsServiceStub.sendMessage.resolves(sendMessageStubValue);

                    clusterStub.setex.resolves(setexStubValue);

                    const result = await service.createVerification(createVerificationDtoMock, languageMock);

                    expect(utilServiceStub.generateRandomNumberString.called).true;
                    if (createVerificationDtoMock.email) {
                        expect(syncdayRedisServiceStub.getEmailVerificationKey.called).true;
                    } else {
                        expect(syncdayRedisServiceStub.getPhoneVerificationKey.called).true;
                    }
                    expect(integrationsServiceStub.sendMessage.called).true;
                    expect(clusterStub.setex.called).true;

                    expect(result).equal(expectedResult);
                });
            });
        });

        describe('Test retrieving user verification status', () => {
            afterEach(() => {
                syncdayRedisServiceStub.getEmailVerification.reset();
                syncdayRedisServiceStub.getEmailVerificationStatus.reset();
            });

            it('should be got true when user verification status is true', async () => {
                const emailMock = TestMockUtil.faker.internet.email();

                const verificationStub = {
                    uuid: TestMockUtil.faker.datatype.uuid(),
                    verificationCode: '0123',
                    email: emailMock
                } as Verification;

                syncdayRedisServiceStub.getEmailVerification.resolves(verificationStub);
                syncdayRedisServiceStub.getEmailVerificationStatus.resolves(true);

                const result = await service.isVerifiedUser(emailMock);

                expect(syncdayRedisServiceStub.getEmailVerification.called).true;
                expect(syncdayRedisServiceStub.getEmailVerificationStatus.called).true;

                expect(result).true;
            });

            it('should be got false when user verification status is false', async () => {
                const emailMock = TestMockUtil.faker.internet.email();

                const verificationStub = {
                    uuid: TestMockUtil.faker.datatype.uuid(),
                    verificationCode: '0123',
                    email: emailMock
                } as Verification;

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
