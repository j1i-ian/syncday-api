import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { User } from '@entity/users/user.entity';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { Event } from '@entity/events/event.entity';
import { DatetimePreset } from '@entity/datetime-presets/datetime-preset.entity';
import { Language } from '@app/enums/language.enum';
import { TokenService } from '../../auth/token/token.service';
import { VerificationService } from '../../auth/verification/verification.service';
import { TestMockUtil } from '../../../test/test-mock-util';
import { UserService } from './user.service';
import { GoogleIntegrationsService } from '../integrations/google-integrations.service';
import { UserSettingService } from './user-setting/user-setting.service';
import { UtilService } from '../util/util.service';
import { SyncdayRedisService } from '../syncday-redis/syncday-redis.service';

const testMockUtil = new TestMockUtil();

describe('Test User Service', () => {
    let module: TestingModule;

    let service: UserService;
    let tokenServiceStub: sinon.SinonStubbedInstance<TokenService>;
    let googleIntegrationServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationsService>;
    let verificationServiceStub: sinon.SinonStubbedInstance<VerificationService>;
    let userSettingServiceStub: sinon.SinonStubbedInstance<UserSettingService>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    let userRepositoryStub: sinon.SinonStubbedInstance<Repository<User>>;
    let eventGroupRepositoryStub: sinon.SinonStubbedInstance<Repository<EventGroup>>;
    let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;
    let datetimePresetRepositoryStub: sinon.SinonStubbedInstance<Repository<DatetimePreset>>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    before(async () => {
        tokenServiceStub = sinon.createStubInstance(TokenService);
        googleIntegrationServiceStub = sinon.createStubInstance(GoogleIntegrationsService);
        verificationServiceStub = sinon.createStubInstance(VerificationService);
        userSettingServiceStub = sinon.createStubInstance(UserSettingService);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        utilServiceStub = sinon.createStubInstance(UtilService);

        userRepositoryStub = sinon.createStubInstance<Repository<User>>(Repository);
        eventGroupRepositoryStub = sinon.createStubInstance<Repository<EventGroup>>(Repository);
        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);
        datetimePresetRepositoryStub =
            sinon.createStubInstance<Repository<DatetimePreset>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: UserSettingService,
                    useValue: userSettingServiceStub
                },
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                {
                    provide: TokenService,
                    useValue: tokenServiceStub
                },
                {
                    provide: GoogleIntegrationsService,
                    useValue: googleIntegrationServiceStub
                },
                {
                    provide: VerificationService,
                    useValue: verificationServiceStub
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: userRepositoryStub
                },
                {
                    provide: getRepositoryToken(EventGroup),
                    useValue: eventGroupRepositoryStub
                },
                {
                    provide: getRepositoryToken(Event),
                    useValue: eventRepositoryStub
                },
                {
                    provide: getRepositoryToken(DatetimePreset),
                    useValue: datetimePresetRepositoryStub
                }
            ]
        }).compile();

        service = module.get<UserService>(UserService);
    });

    after(() => {
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test user finding', () => {
        afterEach(() => {
            userRepositoryStub.findOneOrFail.reset();
            userRepositoryStub.findOneBy.reset();
        });

        it('should be found user by user id', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOneOrFail.resolves(userStub);

            const loadedUser = await service.findUserById(userStub.id);

            const actualPassedParam = userRepositoryStub.findOneOrFail.getCall(0).args[0];
            expect((actualPassedParam.where as FindOptionsWhere<User>).id).equals(userStub.id);

            expect(loadedUser).equal(userStub);
        });

        it('should be found user by email', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOne.resolves(userStub);

            const loadedUser = await service.findUserByEmail(userStub.email);

            const actualPassedParam: FindOneOptions<User> =
                userRepositoryStub.findOne.getCall(0).args[0];

            const userFindOneOptionWhere: FindOptionsWhere<User> =
                actualPassedParam.where as FindOptionsWhere<User>;
            expect(userFindOneOptionWhere.email).equals(userStub.email);

            expect(loadedUser).equal(userStub);
        });

        it('should be not found user by email when user is not exist', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOne.resolves(null);

            const loadedUser = await service.findUserByEmail(userStub.email);

            expect(loadedUser).not.ok;
        });
    });

    describe('Test user sign up', () => {
        let serviceSandbox: sinon.SinonSandbox;

        before(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            userRepositoryStub.create.reset();
            userRepositoryStub.save.reset();
            verificationServiceStub.isVerifiedUser.reset();
            datetimePresetRepositoryStub.save.reset();

            utilServiceStub.getUsetDefaultSetting.reset();

            serviceSandbox.reset();
        });

        after(() => {
            serviceSandbox.restore();
        });

        it('should be created user with email', async () => {
            const plainPassword = 'test';
            const userStub = stubOne(User, {
                hashedPassword: plainPassword
            });
            const languageDummy = Language.ENGLISH;
            const datetimePresetStub = stubOne(DatetimePreset);

            verificationServiceStub.isVerifiedUser.resolves(true);

            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);
            datetimePresetRepositoryStub.save.resolves(datetimePresetStub);

            const createdUser = await service._createUser(
                datasourceMock as EntityManager,
                userStub,
                languageDummy,
                {
                    plainPassword
                }
            );

            expect(utilServiceStub.getUsetDefaultSetting.called).true;
            expect(datetimePresetRepositoryStub.save.called).true;

            expect(createdUser).ok;
            expect(createdUser.email).ok;
        });

        it('should be not created user with email when user is already exist', async () => {
            const alreadySignedUpUser = stubOne(User, {
                nickname: 'foo'
            });
            const plainPasswordDummy = 'test';
            const languageDummy = Language.ENGLISH;
            serviceSandbox.stub(service, 'findUserByEmail').resolves(alreadySignedUpUser);

            const userStub = stubOne(User, {
                nickname: 'bar'
            });

            await expect(
                service._createUser(datasourceMock as EntityManager, userStub, languageDummy, {
                    plainPassword: plainPasswordDummy,
                    emailVerification: true
                })
            ).rejectedWith(BadRequestException);
        });

        // TODO: Breakdown of [should be created user with email] test
        it.skip('Non-members can register as a member with email, password, and name', () => {
            expect(false).true;
        });

        it('should be not created user with email when user verification status is false', async () => {
            const plainPassword = 'test';
            const userStub = stubOne(User, {
                hashedPassword: plainPassword
            });
            const plainPasswordDummy = 'test';
            const languageDummy = Language.ENGLISH;

            verificationServiceStub.isVerifiedUser.resolves(false);

            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);

            await expect(
                service._createUser(datasourceMock as EntityManager, userStub, languageDummy, {
                    plainPassword: plainPasswordDummy,
                    emailVerification: true
                })
            ).rejectedWith(BadRequestException, 'Verification is not completed');
        });

        describe('Test update verification by email', () => {
            let serviceSandbox: sinon.SinonSandbox;

            beforeEach(() => {
                serviceSandbox = sinon.createSandbox();
            });

            afterEach(() => {
                syncdayRedisServiceStub.setEmailVerificationStatus.reset();
                syncdayRedisServiceStub.getEmailVerification.reset();

                serviceSandbox.reset();
                serviceSandbox.restore();
                tokenServiceStub.comparePassword.reset();
            });

            after(() => {
                serviceSandbox.restore();
            });

            it('should be verified when email and verification is matched each other', async () => {
                const emailMock = testMockUtil.getFaker().internet.email();

                const tempUserStub = testMockUtil.getTemporaryUser();
                const userStub = stubOne(User);

                const verificationStub = testMockUtil.getVerificationMock();
                syncdayRedisServiceStub.getEmailVerification.resolves(verificationStub);
                syncdayRedisServiceStub.getTemporaryUser.resolves(tempUserStub);

                userRepositoryStub.create.returns(userStub);
                userRepositoryStub.save.resolves(userStub);

                serviceSandbox.stub(service, '_createUser');

                const updateResult = await service.createUserWithVerificationByEmail(
                    emailMock,
                    verificationStub.verificationCode
                );

                expect(syncdayRedisServiceStub.setEmailVerificationStatus.called).true;
                expect(syncdayRedisServiceStub.getEmailVerification.called).true;

                expect(updateResult).true;
            });

            it('should be not verified when email and verification is not matched', async () => {
                const emailMock = testMockUtil.getFaker().internet.email();
                const verificationCodeMock = '1423';

                syncdayRedisServiceStub.getEmailVerification.resolves(null);

                serviceSandbox.stub(service, '_createUser');

                const updateResult = await service.createUserWithVerificationByEmail(
                    emailMock,
                    verificationCodeMock
                );

                expect(syncdayRedisServiceStub.setEmailVerificationStatus.called).false;
                expect(syncdayRedisServiceStub.getEmailVerification.called).true;

                expect(updateResult).false;
            });
        });
    });

    describe.skip('Test user default setting', () => {
        it('Users want their base URL to be my email address minus the domain.', () => {
            expect(false).true;
        });
        it('Users want to reflect the country time zone detected based on IP as the users default time zone when signing up.', () => {
            expect(false).true;
        });
    });

    describe('Test email validation', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.reset();
            serviceSandbox.restore();
            tokenServiceStub.comparePassword.reset();
        });

        after(() => {
            serviceSandbox.restore();
        });

        it('should be passed email validation when user is exist', async () => {
            const plainPassword = 'thisisUserPlainPassword';

            const userStub = stubOne(User, {
                hashedPassword: plainPassword
            });

            serviceSandbox.stub(service, 'findUserByEmail').resolves(userStub);
            tokenServiceStub.comparePassword.resolves(true);

            const validatedUserOrNull = await service.validateEmailAndPassword(
                userStub.email,
                plainPassword
            );

            expect(validatedUserOrNull).ok;
        });

        it('should be not passed email validation when user is not exist', async () => {
            const dummy = 'thisisUserPlainPassword';

            const userStub = stubOne(User);

            serviceSandbox.stub(service, 'findUserByEmail').resolves(null);

            const validatedUserOrNull = await service.validateEmailAndPassword(
                userStub.email,
                dummy
            );

            expect(validatedUserOrNull).not.ok;
        });

        it('should be not passed password validation when user hashed password is not same to requested password', async () => {
            const dummy = 'thisisUserPlainPassword';

            const userStub = stubOne(User);

            serviceSandbox.stub(service, 'findUserByEmail').resolves(userStub);
            tokenServiceStub.comparePassword.resolves(false);

            const validatedUserOrNull = await service.validateEmailAndPassword(
                userStub.email,
                dummy
            );

            expect(validatedUserOrNull).not.ok;
        });
    });
});
