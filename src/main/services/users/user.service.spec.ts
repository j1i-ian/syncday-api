import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '@entity/users/user.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { Language } from '@app/enums/language.enum';
import { TokenService } from '../../auth/token/token.service';
import { VerificationService } from '../../auth/verification/verification.service';
import { UserService } from './user.service';
import { GoogleIntegrationsService } from '../integrations/google-integrations.service';
import { UserSettingService } from './user-setting/user-setting.service';
import { UtilService } from '../util/util.service';

describe('Test User Service', () => {
    let module: TestingModule;

    let service: UserService;
    let tokenServiceStub: sinon.SinonStubbedInstance<TokenService>;
    let googleIntegrationServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationsService>;
    let verificationServiceStub: sinon.SinonStubbedInstance<VerificationService>;
    let userSettingServiceStub: sinon.SinonStubbedInstance<UserSettingService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    let userRepositoryStub: sinon.SinonStubbedInstance<Repository<User>>;

    before(async () => {
        tokenServiceStub = sinon.createStubInstance(TokenService);
        googleIntegrationServiceStub = sinon.createStubInstance(GoogleIntegrationsService);
        verificationServiceStub = sinon.createStubInstance(VerificationService);
        userSettingServiceStub = sinon.createStubInstance(UserSettingService);
        utilServiceStub = sinon.createStubInstance(UtilService);

        userRepositoryStub = sinon.createStubInstance<Repository<User>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(User),
                    useValue: userRepositoryStub
                },
                {
                    provide: UserSettingService,
                    useValue: userSettingServiceStub
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
            userRepositoryStub.findOneByOrFail.reset();
            userRepositoryStub.findOneBy.reset();
        });

        it('should be found user by user id', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOneByOrFail.resolves(userStub);

            const loadedUser = await service.findUserById(userStub.id);

            const actualPassedParam = userRepositoryStub.findOneByOrFail.getCall(0)
                .args[0] as FindOptionsWhere<User>;
            expect(actualPassedParam.id).equals(userStub.id);

            expect(loadedUser).equal(userStub);
        });

        it('should be found user by email', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOneBy.resolves(userStub);

            const loadedUser = await service.findUserByEmail(userStub.email);

            const actualPassedParam = userRepositoryStub.findOneBy.getCall(0)
                .args[0] as FindOptionsWhere<User>;
            expect(actualPassedParam.email).equals(userStub.email);

            expect(loadedUser).equal(userStub);
        });

        it('should be not found user by email when user is not exist', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOneBy.resolves(null);

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

            verificationServiceStub.isVerifiedUser.resolves(true);

            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);

            const createdUser = await service.createUser(
                {
                    ...(userStub as unknown as CreateUserRequestDto),
                    plainPassword
                },
                languageDummy
            );

            expect(utilServiceStub.getUsetDefaultSetting.called).true;

            expect(createdUser).ok;
            expect(createdUser.email).ok;
        });

        it('should be not created user with email when user is already exist', async () => {
            const alreadySignedUpUser = stubOne(User, {
                nickname: 'foo'
            });
            const languageDummy = Language.ENGLISH;
            serviceSandbox.stub(service, 'findUserByEmail').resolves(alreadySignedUpUser);

            const userStub = stubOne(User, {
                nickname: 'bar'
            });

            await expect(
                service.createUser(userStub as unknown as CreateUserRequestDto, languageDummy)
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
            const languageDummy = Language.ENGLISH;

            verificationServiceStub.isVerifiedUser.resolves(false);

            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);

            await expect(
                service.createUser(userStub as unknown as CreateUserRequestDto, languageDummy)
            ).rejectedWith(BadRequestException, 'Verification is not completed');
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

        before(() => {
            serviceSandbox = sinon.createSandbox();
        });

        after(() => {
            serviceSandbox.restore();
        });

        afterEach(() => {
            serviceSandbox.reset();
            serviceSandbox.restore();
            tokenServiceStub.comparePassword.reset();
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
