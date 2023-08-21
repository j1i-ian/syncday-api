import { Test, TestingModule } from '@nestjs/testing';
import { Cluster } from 'ioredis';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { IntegrationsService } from '@services/integrations/integrations.service';
import { UserService } from '@services/users/user.service';
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
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;

    beforeEach(async () => {
        clusterStub = sinon.createStubInstance(Cluster);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        integrationsServiceStub = sinon.createStubInstance(IntegrationsService);
        utilServiceStub = sinon.createStubInstance(UtilService);
        userServiceStub = sinon.createStubInstance(UserService);

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
                },
                {
                    provide: UserService,
                    useValue: userServiceStub
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
            let serviceSandbox: sinon.SinonSandbox;

            beforeEach(() => {
                serviceSandbox = sinon.createSandbox();
            });

            afterEach(() => {
                serviceSandbox.restore();
            });

            [
                {
                    description: 'should be created email verification when cluster saving is success',
                    languageDummy: Language.ENGLISH,
                    createVerificationDtoMock: {
                        email: TestMockUtil.faker.internet.email()
                    } as CreateVerificationDto,
                    fakeKeyStubValue: 'local:verifications:email:alan@sync.day',
                    generateRandomNumberStringStubValue: '0123',
                    uuidStubValue: TestMockUtil.faker.datatype.uuid(),
                    setexStubValue: 'OK' as const,
                    expectedResult: true
                },
                {
                    description: 'should be not created email verification when cluster saving is failed',
                    languageDummy: Language.ENGLISH,
                    createVerificationDtoMock: {
                        email: TestMockUtil.faker.internet.email()
                    } as CreateVerificationDto,
                    fakeKeyStubValue: 'local:verifications:email:alan@sync.day',
                    generateRandomNumberStringStubValue: '0123',
                    uuidStubValue: TestMockUtil.faker.datatype.uuid(),
                    setexStubValue: undefined,
                    expectedResult: false
                },
                {
                    description: 'should be created phoneNumber verification when cluster saving is success',
                    languageDummy: Language.ENGLISH,
                    createVerificationDtoMock: {
                        phoneNumber: TestMockUtil.faker.phone.number()
                    } as CreateVerificationDto,
                    fakeKeyStubValue: 'local:verifications:phone:+821012345678',
                    generateRandomNumberStringStubValue: '0123',
                    uuidStubValue: TestMockUtil.faker.datatype.uuid(),
                    setexStubValue: 'OK' as const,
                    expectedResult: true
                },
                {
                    description: 'should be not created phoneNumber verification when cluster saving is failed',
                    languageDummy: Language.ENGLISH,
                    createVerificationDtoMock: {
                        phoneNumber: TestMockUtil.faker.phone.number()
                    } as CreateVerificationDto,
                    fakeKeyStubValue: 'local:verifications:phone:+821012345678',
                    generateRandomNumberStringStubValue: '0123',
                    uuidStubValue: TestMockUtil.faker.datatype.uuid(),
                    setexStubValue: undefined,
                    expectedResult: false
                }
            ].forEach( function ({
                description,
                languageDummy,
                createVerificationDtoMock,
                fakeKeyStubValue,
                generateRandomNumberStringStubValue,
                uuidStubValue,
                setexStubValue,
                expectedResult
            }) {
                it(description, async () => {

                    utilServiceStub.generateRandomNumberString.returns(generateRandomNumberStringStubValue);
                    utilServiceStub.generateUUID.returns(uuidStubValue);

                    if (createVerificationDtoMock.email) {
                        syncdayRedisServiceStub.getEmailVerificationKey.returns(fakeKeyStubValue);
                    } else {
                        syncdayRedisServiceStub.getPhoneVerificationKey.returns(fakeKeyStubValue);
                    }

                    serviceSandbox.stub(service, 'publishSyncdayNotification').resolves(true);

                    clusterStub.setex.resolves(setexStubValue);

                    const result = await service.createVerification(createVerificationDtoMock, languageDummy);

                    expect(utilServiceStub.generateRandomNumberString.called).true;
                    if (createVerificationDtoMock.email) {
                        expect(syncdayRedisServiceStub.getEmailVerificationKey.called).true;
                    } else {
                        expect(syncdayRedisServiceStub.getPhoneVerificationKey.called).true;
                    }

                    expect(clusterStub.setex.called).true;

                    expect(result).equal(expectedResult);
                });
            });
        });

        describe('Test publishSyncdayNotification', () => {
            [
                {
                    description: 'should be published email verification',
                    languageMock: Language.ENGLISH,
                    createVerificationDtoMock: {
                        email: TestMockUtil.faker.internet.email()
                    } as Verification,
                    expectedResult: true
                },
                {
                    description: 'should be published notification ',
                    languageMock: Language.ENGLISH,
                    createVerificationDtoMock: {
                        phoneNumber: TestMockUtil.faker.phone.number()
                    } as Verification,
                    expectedResult: true
                }
            ].forEach(function ({
                description,
                languageMock,
                createVerificationDtoMock,
                expectedResult
            }) {
                it(description, async () => {

                    const isAlreadySignedUpUserOnEmailVerificationMock = true;

                    integrationsServiceStub.sendMessage.resolves(true);

                    const result = await service.publishSyncdayNotification(
                        languageMock,
                        createVerificationDtoMock,
                        isAlreadySignedUpUserOnEmailVerificationMock
                    );

                    expect(integrationsServiceStub.sendMessage.called).true;
                    expect(result).equal(expectedResult);
                });

            });
        });

        describe('Test validateCreateVerificationDto', () => {

            [
                {
                    description:'should be passed validation of createVerificationDto',
                    createVerificationDtoMock: {
                        email: TestMockUtil.faker.internet.email()
                    } as CreateVerificationDto,
                    expectedResult: true
                },
                {
                    description:'should be passed validation of createVerificationDto',
                    createVerificationDtoMock: {
                        phoneNumber: TestMockUtil.faker.phone.number()
                    } as CreateVerificationDto,
                    expectedResult: true
                },
                {
                    description:'should be not passed validation of createVerificationDto',
                    createVerificationDtoMock: {} as CreateVerificationDto,
                    expectedResult: false
                }
            ].forEach(({
                description,
                createVerificationDtoMock,
                expectedResult
            }) => {

                it(description, () => {

                    const result = service.validateCreateVerificationDto(createVerificationDtoMock);

                    expect(result).to.be.equals(expectedResult);
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
