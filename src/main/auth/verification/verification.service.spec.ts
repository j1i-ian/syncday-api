import { Test, TestingModule } from '@nestjs/testing';
import { Cluster } from 'ioredis';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { UserService } from '@services/users/user.service';
import { Verification } from '@entity/verifications/verification.interface';
import { CreateVerificationDto } from '@dto/verifications/create-verification.dto';
import { UpdatePhoneWithVerificationDto } from '@dto/verifications/update-phone-with-verification.dto';
import { Language } from '@app/enums/language.enum';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { TestMockUtil } from '@test/test-mock-util';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
    let service: VerificationService;

    let clusterStub: sinon.SinonStubbedInstance<Cluster>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;
    let notificationsServiceStub: sinon.SinonStubbedInstance<NotificationsService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;

    beforeEach(async () => {
        clusterStub = sinon.createStubInstance(Cluster);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        notificationsServiceStub = sinon.createStubInstance(NotificationsService);
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
                    provide: NotificationsService,
                    useValue: notificationsServiceStub
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

    describe('Test create verification test', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            clusterStub.setex.reset();
            clusterStub.get.reset();
            utilServiceStub.generateRandomNumberString.reset();
            notificationsServiceStub.sendMessage.reset();
            syncdayRedisServiceStub.getEmailVerificationKey.reset();
            syncdayRedisServiceStub.getPhoneVerificationKey.reset();

            serviceSandbox.restore();
        });

        [
            {
                description: 'should be created email verification when cluster saving is success',
                languageDummy: Language.ENGLISH,
                createVerificationDtoMock: {
                    email: TestMockUtil.faker.internet.email(),
                    uuid: TestMockUtil.faker.datatype.uuid()
                } as CreateVerificationDto,
                fakeKeyStubValue: 'local:verifications:email:alan@sync.day',
                generateRandomNumberStringStubValue: '0123',
                isSignUpVerification: false,
                setexStubValue: 'OK' as const,
                expectedResult: true
            },
            {
                description: 'should be not created email verification when cluster saving is failed',
                languageDummy: Language.ENGLISH,
                createVerificationDtoMock: {
                    email: TestMockUtil.faker.internet.email(),
                    uuid: TestMockUtil.faker.datatype.uuid()
                } as CreateVerificationDto,
                fakeKeyStubValue: 'local:verifications:email:alan@sync.day',
                generateRandomNumberStringStubValue: '0123',
                isSignUpVerification: false,
                setexStubValue: undefined,
                expectedResult: false
            },
            {
                description: 'should be created phoneNumber verification when cluster saving is success',
                languageDummy: Language.ENGLISH,
                createVerificationDtoMock: {
                    phoneNumber: TestMockUtil.faker.phone.number(),
                    uuid: TestMockUtil.faker.datatype.uuid()
                } as CreateVerificationDto,
                fakeKeyStubValue: 'local:verifications:phone:+821012345678',
                generateRandomNumberStringStubValue: '0123',
                isSignUpVerification: false,
                setexStubValue: 'OK' as const,
                expectedResult: true
            },
            {
                description: 'should be not created phoneNumber verification when cluster saving is failed',
                languageDummy: Language.ENGLISH,
                createVerificationDtoMock: {
                    phoneNumber: TestMockUtil.faker.phone.number(),
                    uuid: TestMockUtil.faker.datatype.uuid()
                } as CreateVerificationDto,
                fakeKeyStubValue: 'local:verifications:phone:+821012345678',
                generateRandomNumberStringStubValue: '0123',
                isSignUpVerification: false,
                setexStubValue: undefined,
                expectedResult: false
            }
        ].forEach( function ({
            description,
            languageDummy,
            createVerificationDtoMock,
            fakeKeyStubValue,
            generateRandomNumberStringStubValue,
            isSignUpVerification,
            setexStubValue,
            expectedResult
        }) {
            it(description, async () => {

                utilServiceStub.generateRandomNumberString.returns(generateRandomNumberStringStubValue);

                if (createVerificationDtoMock.email) {
                    syncdayRedisServiceStub.getEmailVerificationKey.returns(fakeKeyStubValue);
                    userServiceStub.findUserByEmail.resolves(null);
                } else {
                    syncdayRedisServiceStub.getPhoneVerificationKey.returns(fakeKeyStubValue);
                    userServiceStub.searchByEmailOrPhone.resolves([]);
                }

                serviceSandbox.stub(service, 'publishSyncdayNotification').resolves(true);

                clusterStub.setex.resolves(setexStubValue);

                const result = await service.createVerification(createVerificationDtoMock, languageDummy, isSignUpVerification);

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

    describe('Test verification update', () => {

        afterEach(() => {
            syncdayRedisServiceStub.getPhoneVerificationKey.reset();
            clusterStub.get.reset();
            syncdayRedisServiceStub.setPhoneVerificationStatus.reset();
        });

        it('should be updated verification', async () => {

            const generatedUUIDByClientMock = TestMockUtil.faker.datatype.uuid();
            const updatePhoneWithVerificationDtoMock: UpdatePhoneWithVerificationDto = {
                phone: '+821012345678',
                verificationCode: '0123',
                uuid: generatedUUIDByClientMock
            };
            const verificationStub = {
                verificationCode: '0123',
                uuid: generatedUUIDByClientMock
            } as Verification;

            clusterStub.get.resolves(JSON.stringify(verificationStub));

            const updateSuccess = await service.update(updatePhoneWithVerificationDtoMock);

            expect(updateSuccess).true;
            expect(syncdayRedisServiceStub.getPhoneVerificationKey.called).true;
            expect(clusterStub.get.called).true;
            expect(syncdayRedisServiceStub.setPhoneVerificationStatus.called).true;
        });

        it('should be not updated verification when update request is invalid', async () => {

            const generatedUUIDByClientMock = TestMockUtil.faker.datatype.uuid();
            const updatePhoneWithVerificationDtoMock: UpdatePhoneWithVerificationDto = {
                phone: '+821012345678',
                verificationCode: '0123',
                uuid: generatedUUIDByClientMock
            };
            const verificationStub = {
                verificationCode: '0123',
                uuid: 'abcd'
            } as Verification;

            clusterStub.get.resolves(JSON.stringify(verificationStub));

            const updateSuccess = await service.update(updatePhoneWithVerificationDtoMock);

            expect(updateSuccess).false;
            expect(syncdayRedisServiceStub.getPhoneVerificationKey.called).true;
            expect(clusterStub.get.called).true;
            expect(syncdayRedisServiceStub.setPhoneVerificationStatus.called).false;
        });

    });

    describe('Test publishSyncdayNotification', () => {

        afterEach(() => {
            clusterStub.setex.reset();
            clusterStub.get.reset();
            utilServiceStub.generateRandomNumberString.reset();
            notificationsServiceStub.sendMessage.reset();
            syncdayRedisServiceStub.getEmailVerificationKey.reset();
            syncdayRedisServiceStub.getPhoneVerificationKey.reset();
        });

        [
            {
                description: 'should be published user verification email',
                languageMock: Language.ENGLISH,
                createVerificationDtoMock: {
                    email: TestMockUtil.faker.internet.email()
                } as Verification,
                isSignUpVerification: false,
                expectedResult: true
            },
            {
                description: 'should be published user alreday-sign-up email',
                languageMock: Language.ENGLISH,
                createVerificationDtoMock: {
                    email: TestMockUtil.faker.internet.email()
                } as Verification,
                isSignUpVerification: true,
                expectedResult: true
            },
            {
                description: 'should be published phoneNumber verification message',
                languageMock: Language.ENGLISH,
                createVerificationDtoMock: {
                    phoneNumber: TestMockUtil.faker.phone.number()
                } as Verification,
                isSignUpVerification: false,
                expectedResult: true
            },
            {
                description: 'should be published phoneNumber verification for already signed-up user',
                languageMock: Language.ENGLISH,
                createVerificationDtoMock: {
                    phoneNumber: TestMockUtil.faker.phone.number()
                } as Verification,
                isSignUpVerification: true,
                expectedResult: true
            }
        ].forEach(function ({
            description,
            languageMock,
            createVerificationDtoMock,
            isSignUpVerification,
            expectedResult
        }) {
            it(description, async () => {

                notificationsServiceStub.sendMessage.resolves(true);

                const result = await service.publishSyncdayNotification(
                    languageMock,
                    createVerificationDtoMock,
                    isSignUpVerification
                );

                expect(notificationsServiceStub.sendMessage.called).true;
                expect(result).equal(expectedResult);
            });

        });
    });

    describe('Test validateCreateVerificationDto', () => {

        afterEach(() => {
            clusterStub.setex.reset();
            clusterStub.get.reset();
            utilServiceStub.generateRandomNumberString.reset();
            notificationsServiceStub.sendMessage.reset();
            syncdayRedisServiceStub.getEmailVerificationKey.reset();
            syncdayRedisServiceStub.getPhoneVerificationKey.reset();
        });

        [
            {
                description:'should be passed validation of createVerificationDto',
                createVerificationDtoMock: {
                    email: TestMockUtil.faker.internet.email(),
                    uuid: TestMockUtil.faker.datatype.uuid()
                } as CreateVerificationDto,
                expectedResult: true
            },
            {
                description:'should be passed validation of createVerificationDto',
                createVerificationDtoMock: {
                    phoneNumber: TestMockUtil.faker.phone.number(),
                    uuid: TestMockUtil.faker.datatype.uuid()
                } as CreateVerificationDto,
                expectedResult: true
            },
            {
                description:'should be not passed validation of createVerificationDto without uuid',
                createVerificationDtoMock: {
                    phoneNumber: TestMockUtil.faker.phone.number()
                } as CreateVerificationDto,
                expectedResult: false
            },
            {
                description:'should be not passed validation of createVerificationDto without uuid',
                createVerificationDtoMock: {
                    email: TestMockUtil.faker.internet.email()
                } as CreateVerificationDto,
                expectedResult: false
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
            clusterStub.setex.reset();
            clusterStub.get.reset();
            utilServiceStub.generateRandomNumberString.reset();
            notificationsServiceStub.sendMessage.reset();
            syncdayRedisServiceStub.getEmailVerificationKey.reset();
            syncdayRedisServiceStub.getPhoneVerificationKey.reset();
        });
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
