import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { firstValueFrom, of } from 'rxjs';
import { Availability } from '@core/entities/availability/availability.entity';
import { OAuth2AccountUserProfileMetaInfo } from '@core/interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { TeamService } from '@services/team/team.service';
import { CreatedUserTeamProfile } from '@services/users/created-user-team-profile.interface';
import { OAuth2TokenServiceLocator } from '@services/oauth2/oauth2-token.service-locator';
import { GoogleOAuth2TokenService } from '@services/oauth2/google-oauth2-token/google-oauth2-token.service';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { AvailabilityService } from '@services/availability/availability.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { EventsService } from '@services/events/events.service';
import { User } from '@entity/users/user.entity';
import { EventGroup } from '@entity/events/event-group.entity';
import { Event } from '@entity/events/event.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { UpdatePhoneWithVerificationDto } from '@dto/verifications/update-phone-with-verification.dto';
import { Language } from '@app/enums/language.enum';
import { EmailVertificationFailException } from '@app/exceptions/users/email-verification-fail.exception';
import { PhoneVertificationFailException } from '@app/exceptions/users/phone-verification-fail.exception';
import { VerificationService } from '../../auth/verification/verification.service';
import { TestMockUtil } from '../../../test/test-mock-util';
import { UserService } from './user.service';
import { UtilService } from '../util/util.service';
import { SyncdayRedisService } from '../syncday-redis/syncday-redis.service';

const testMockUtil = new TestMockUtil();

describe('Test User Service', () => {
    let module: TestingModule;

    let service: UserService;

    let oauth2TokenServiceLocatorStub: sinon.SinonStubbedInstance<OAuth2TokenServiceLocator>;
    let oauth2TokenServiceStub: sinon.SinonStubbedInstance<GoogleOAuth2TokenService>;
    let oauth2TokenServiceConverterStub: sinon.SinonStubbedInstance<GoogleConverterService>;

    let timeUtilServiceStub: sinon.SinonStubbedInstance<TimeUtilService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;
    let oauth2AccountsServiceStub: sinon.SinonStubbedInstance<OAuth2AccountsService>;
    let profilesServiceStub: sinon.SinonStubbedInstance<ProfilesService>;
    let teamSettingServiceStub: sinon.SinonStubbedInstance<TeamSettingService>;
    let availabilityServiceStub: sinon.SinonStubbedInstance<AvailabilityService>;
    let notificationsServiceStub: sinon.SinonStubbedInstance<NotificationsService>;
    let googleIntegrationsServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationsService>;

    let verificationServiceStub: sinon.SinonStubbedInstance<VerificationService>;
    let teamServiceStub: sinon.SinonStubbedInstance<TeamService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let eventsRedisRepositoryStub: sinon.SinonStubbedInstance<EventsRedisRepository>;
    let availabilityRedisRepositoryStub: sinon.SinonStubbedInstance<AvailabilityRedisRepository>;

    let userRepositoryStub: sinon.SinonStubbedInstance<Repository<User>>;
    let eventGroupRepositoryStub: sinon.SinonStubbedInstance<Repository<EventGroup>>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    before(async () => {
        oauth2TokenServiceStub = sinon.createStubInstance(GoogleOAuth2TokenService);
        oauth2TokenServiceLocatorStub = sinon.createStubInstance(OAuth2TokenServiceLocator);
        oauth2TokenServiceLocatorStub.get.returns(oauth2TokenServiceStub);
        oauth2TokenServiceConverterStub = sinon.createStubInstance(GoogleConverterService);
        sinon.stub(GoogleOAuth2TokenService.prototype, 'converter')
            .get(() =>  oauth2TokenServiceConverterStub);

        timeUtilServiceStub = sinon.createStubInstance(TimeUtilService);
        utilServiceStub = sinon.createStubInstance(UtilService);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        oauth2AccountsServiceStub = sinon.createStubInstance(OAuth2AccountsService);
        profilesServiceStub = sinon.createStubInstance(ProfilesService);
        teamSettingServiceStub = sinon.createStubInstance(TeamSettingService);
        availabilityServiceStub = sinon.createStubInstance(AvailabilityService);
        notificationsServiceStub = sinon.createStubInstance(NotificationsService);
        googleIntegrationsServiceStub = sinon.createStubInstance(GoogleIntegrationsService);
        verificationServiceStub = sinon.createStubInstance(VerificationService);
        teamServiceStub = sinon.createStubInstance(TeamService);

        eventsServiceStub = sinon.createStubInstance(EventsService);
        eventsRedisRepositoryStub = sinon.createStubInstance(EventsRedisRepository);
        availabilityRedisRepositoryStub = sinon.createStubInstance(AvailabilityRedisRepository);

        userRepositoryStub = sinon.createStubInstance<Repository<User>>(Repository);
        eventGroupRepositoryStub = sinon.createStubInstance<Repository<EventGroup>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: OAuth2TokenServiceLocator,
                    useValue: oauth2TokenServiceLocatorStub
                },
                {
                    provide: TimeUtilService,
                    useValue: timeUtilServiceStub
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                {
                    provide: OAuth2AccountsService,
                    useValue: oauth2AccountsServiceStub
                },
                {
                    provide: ProfilesService,
                    useValue: profilesServiceStub
                },
                {
                    provide: TeamSettingService,
                    useValue: teamSettingServiceStub
                },
                {
                    provide: AvailabilityService,
                    useValue: availabilityServiceStub
                },
                {
                    provide: NotificationsService,
                    useValue: notificationsServiceStub
                },
                {
                    provide: GoogleIntegrationsService,
                    useValue: googleIntegrationsServiceStub
                },
                {
                    provide: VerificationService,
                    useValue: verificationServiceStub
                },
                {
                    provide: TeamService,
                    useValue: teamServiceStub
                },
                {
                    provide: EventsService,
                    useValue: eventsServiceStub
                },
                {
                    provide: EventsRedisRepository,
                    useValue: eventsRedisRepositoryStub
                },
                {
                    provide: AvailabilityRedisRepository,
                    useValue: availabilityRedisRepositoryStub
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: userRepositoryStub
                },
                {
                    provide: getRepositoryToken(EventGroup),
                    useValue: eventGroupRepositoryStub
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

    describe('Test user searching', () => {

        afterEach(() => {
            userRepositoryStub.findBy.reset();
        });

        it('should be searched by emails or phones', async () => {
            const userStubs = stub(User);

            userRepositoryStub.findBy.resolves(userStubs);

            const emails = userStubs.map((_user) => _user.email as string);

            const loadedUsers = await service.search({
                emails
            });

            expect(loadedUsers).ok;
            expect(loadedUsers.length).ok;
        });
    });

    describe('Test user finding', () => {
        afterEach(() => {
            userRepositoryStub.findOneOrFail.reset();
            userRepositoryStub.findOne.reset();
        });

        it('should be found user by user id', async () => {
            const userStub = stubOne(User);

            userRepositoryStub.findOneOrFail.resolves(userStub);

            const loadedUser = await service.findUser({
                userId: userStub.id
            });

            const actualPassedParam = userRepositoryStub.findOneOrFail.getCall(0).args[0];
            expect((actualPassedParam.where as FindOptionsWhere<User>).id).equals(userStub.id);

            expect(loadedUser).equal(userStub);
        });

        it('should be found user by email', async () => {
            const userStub = stubOne(User, {
                email: TestMockUtil.faker.internet.email()
            });

            userRepositoryStub.findOne.resolves(userStub);

            const loadedUser = await service.findUserByLocalAuth(userStub.email as string);

            const actualPassedParam: FindOneOptions<User> =
                userRepositoryStub.findOne.getCall(0).args[0];

            const userFindOneOptionWhere: FindOptionsWhere<User> =
                actualPassedParam.where as FindOptionsWhere<User>;
            expect(userFindOneOptionWhere.email).equals(userStub.email);

            expect(loadedUser).equal(userStub);
        });

        it('should be found user by phone', async () => {
            const userStub = stubOne(User, {
                phone: TestMockUtil.faker.phone.number()
            });

            userRepositoryStub.findOne.resolves(userStub);

            const loadedUser = await service.findUserByLocalAuth(userStub.phone as string);

            const actualPassedParam: FindOneOptions<User> =
                userRepositoryStub.findOne.getCall(0).args[0];

            const userFindOneOptionWhere: FindOptionsWhere<User> =
                actualPassedParam.where as FindOptionsWhere<User>;
            expect(userFindOneOptionWhere.phone).equals(userStub.phone);

            expect(loadedUser).equal(userStub);
        });

        it('should be not found user by email when user is not exist', async () => {
            const userStub = stubOne(User, {
                email: TestMockUtil.faker.internet.email()
            });

            userRepositoryStub.findOne.resolves(null);

            const loadedUser = await service.findUserByLocalAuth(userStub.email as string);

            expect(loadedUser).not.ok;
        });
    });

    describe('Test createUser overloading', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            oauth2TokenServiceConverterStub.convertToCreateUserRequestDTO.returns({} as any);
        });

        afterEach(() => {

            oauth2TokenServiceConverterStub.convertToCreateUserRequestDTO.reset();

            serviceSandbox.restore();
        });

        [
            {
                description: 'should be overloaded method for createUserWithVerificationByEmail',
                getArgs: () => {
                    const emailMock = TestMockUtil.faker.internet.email();
                    const userSettingStub = stubOne(UserSetting);

                    const verificationStub = testMockUtil.getVerificationMock();

                    const args = [
                        emailMock,
                        verificationStub.verificationCode,
                        userSettingStub.preferredTimezone
                    ] as [string, string, string];

                    return args;
                },
                createUserWithVerificationByEmailCall: true,
                convertToCreateUserRequestDTOCall: false,
                createUserWithOAuth2Call: false
            },
            {
                description: 'should be overloaded method for createUserByOAuth2',
                getArgs: () => {
                    const integrationParams = {} as OAuth2AccountUserProfileMetaInfo;
                    const timezoneMock = 'Asia/Seoul';
                    const language = Language.ENGLISH;

                    const args = [
                        IntegrationVendor.GOOGLE,
                        integrationParams,
                        timezoneMock,
                        language
                    ] as [
                        IntegrationVendor,
                        OAuth2AccountUserProfileMetaInfo,
                        string,
                        Language
                    ];

                    return args;
                },
                createUserWithVerificationByEmailCall: false,
                convertToCreateUserRequestDTOCall: true,
                createUserWithOAuth2Call: true
            }
        ].forEach(function ({
            description,
            getArgs,
            createUserWithVerificationByEmailCall,
            convertToCreateUserRequestDTOCall,
            createUserWithOAuth2Call
        }) {

            it(description, async () => {

                const userStub = stubOne(User);
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);

                const createUserWithVerificationByEmailStub = serviceSandbox.stub(service, '_createUserWithVerificationByEmail').resolves({
                    createdUser: userStub,
                    createdProfile: profileStub,
                    createdTeam: teamStub
                });
                const createUserByOAuth2Stub = serviceSandbox.stub(service, 'createUserWithOAuth2').resolves({ createdUser: userStub } as CreatedUserTeamProfile);

                const args = getArgs();

                const createdUser = await firstValueFrom(
                    // eslint-disable-next-line prefer-spread
                    service.createUser.apply(service, args as any)
                );

                expect(createdUser).ok;

                expect(createUserWithVerificationByEmailStub.called).equals(createUserWithVerificationByEmailCall);
                expect(oauth2TokenServiceConverterStub.convertToCreateUserRequestDTO.called).equals(convertToCreateUserRequestDTOCall);
                expect(createUserByOAuth2Stub.called).equals(createUserWithOAuth2Call);
            });
        });

    });

    describe('Test user sign up', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {

            verificationServiceStub.isVerifiedUser.reset();
            userRepositoryStub.create.reset();
            utilServiceStub.getUserDefaultSetting.reset();
            utilServiceStub.hash.reset();

            teamSettingServiceStub.fetchTeamWorkspaceStatus.reset();
            utilServiceStub.getDefaultTeamWorkspace.reset();

            teamServiceStub._create.reset();
            userRepositoryStub.save.reset();
            profilesServiceStub._create.reset();

            timeUtilServiceStub.getDefaultAvailableTimes.reset();
            utilServiceStub.getDefaultAvailabilityName.reset();
            availabilityServiceStub._create.reset();

            utilServiceStub.getDefaultEvent.reset();

            eventGroupRepositoryStub.save.reset();
            eventsServiceStub._create.reset();

            serviceSandbox.reset();
            serviceSandbox.restore();
        });

        it('should be created user with email', async () => {
            const plainPassword = 'test';
            const emailMock = TestMockUtil.faker.internet.email('t.e.s.t.', undefined, 'gmail.com');

            const expectedWorkspace = 'test';

            const userStub = stubOne(User, {
                email: emailMock,
                hashedPassword: plainPassword
            });

            const profileStub = stubOne(Profile);
            const teamSettingStub = stubOne(TeamSetting, {
                workspace: expectedWorkspace
            });
            const teamStub = stubOne(Team, {
                teamSetting: teamSettingStub
            });
            const languageDummy = Language.ENGLISH;
            const defaultUserSettingStub = stubOne(UserSetting);
            const eventGroupStub = stubOne(EventGroup);
            const defaultEventStub = stubOne(Event);
            const availabilityStub = stubOne(Availability);
            const availabilityBodyStub = testMockUtil.getAvailabilityBodyMock();

            const findUserByEmailStub = serviceSandbox.stub(service, 'findUserByLocalAuth');

            verificationServiceStub.isVerifiedUser.resolves(true);
            findUserByEmailStub.resolves(null);
            teamSettingServiceStub.fetchTeamWorkspaceStatus.resolves(true);
            utilServiceStub.getUserDefaultSetting.returns(defaultUserSettingStub);
            utilServiceStub.hash.returns(userStub.hashedPassword);
            profilesServiceStub._create.resolves(profileStub);

            teamServiceStub._create.resolves(teamStub);
            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);
            timeUtilServiceStub.getDefaultAvailableTimes.returns(availabilityBodyStub.availableTimes);
            utilServiceStub.getDefaultAvailabilityName.returns(availabilityStub.name);
            availabilityServiceStub._create.resolves(availabilityStub);

            utilServiceStub.getDefaultEvent.returns(defaultEventStub);
            eventsServiceStub._create.resolves(defaultEventStub);
            eventGroupRepositoryStub.save.resolves(eventGroupStub);

            const {
                createdUser,
                createdProfile,
                createdTeam
            } = await service._createUser(
                datasourceMock as EntityManager,
                userStub,
                profileStub.name as string,
                languageDummy,
                defaultUserSettingStub.preferredTimezone,
                {
                    plainPassword,
                    emailVerification: true,
                    alreadySignedUpUserCheck: true
                }
            );

            expect(verificationServiceStub.isVerifiedUser.called).true;
            expect(findUserByEmailStub.called).true;
            expect(teamServiceStub._create.called).true;
            expect(userRepositoryStub.create.called).true;
            expect(teamSettingServiceStub.fetchTeamWorkspaceStatus.called).true;
            expect(utilServiceStub.getUserDefaultSetting.called).true;
            expect(utilServiceStub.hash.called).true;
            expect(profilesServiceStub._create.called).true;

            expect(userRepositoryStub.save.called).true;
            expect(utilServiceStub.getDefaultEvent.called).true;
            expect(timeUtilServiceStub.getDefaultAvailableTimes.called).true;
            expect(utilServiceStub.getDefaultAvailabilityName.called).true;
            expect(availabilityServiceStub._create.called).true;
            expect(eventsServiceStub._create.called).true;
            expect(eventGroupRepositoryStub.save.called).true;

            expect(createdUser).ok;
            expect(createdProfile).ok;
            expect(createdUser.email).ok;
            expect(createdUser.email).equals(emailMock);
            expect(createdTeam.teamSetting.workspace).contains(expectedWorkspace);
        });

        it('should be not created user with email when user is already exist', async () => {
            const timezoneMock = stubOne(UserSetting).preferredTimezone;
            const alreadySignedUpUserProfile = stubOne(Profile, {
                name: 'foo',
                default: true
            });
            const alreadySignedUpUser = stubOne(User, {
                profiles: [alreadySignedUpUserProfile]
            });
            const plainPasswordDummy = 'test';
            const languageDummy = Language.ENGLISH;
            serviceSandbox.stub(service, 'findUserByLocalAuth').resolves(alreadySignedUpUser);

            const userStub = stubOne(User);
            const profileNameMock = 'bar';

            await expect(
                service._createUser(
                    datasourceMock as EntityManager,
                    userStub,
                    profileNameMock,
                    languageDummy,
                    timezoneMock,
                    {
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
            const timezoneMock = stubOne(UserSetting).preferredTimezone;
            const userStub = stubOne(User, {
                hashedPassword: plainPassword
            });
            const profileNameMock = stubOne(Profile).name as string;
            const plainPasswordDummy = 'test';
            const languageDummy = Language.ENGLISH;

            verificationServiceStub.isVerifiedUser.resolves(false);

            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);

            await expect(
                service._createUser(
                    datasourceMock as EntityManager,
                    userStub,
                    profileNameMock,
                    languageDummy,
                    timezoneMock,
                    {
                        plainPassword: plainPasswordDummy,
                        emailVerification: true
                    }
                )
            ).rejectedWith(BadRequestException, 'Verification is not completed');
        });

        it('should be created user with phone', async () => {
            const plainPassword = 'test';
            const phoneNumberMock = TestMockUtil.faker.phone.number('+8210########');

            const expectedWorkspace = 'test';

            const userStub = stubOne(User, {
                email: 'fakeUUID',
                phone: phoneNumberMock,
                hashedPassword: plainPassword
            });

            const profileStub = stubOne(Profile);
            const teamSettingStub = stubOne(TeamSetting, {
                workspace: expectedWorkspace
            });
            const teamStub = stubOne(Team, {
                teamSetting: teamSettingStub
            });
            const languageDummy = Language.ENGLISH;
            const defaultUserSettingStub = stubOne(UserSetting);
            const defaultEventStub = stubOne(Event);
            const eventGroupStub = stubOne(EventGroup);
            const availabilityStub = stubOne(Availability);
            const availabilityBodyStub = testMockUtil.getAvailabilityBodyMock();

            const searchStub = serviceSandbox.stub(service, 'search');

            verificationServiceStub.isVerifiedUser.resolves(true);
            searchStub.resolves([]);
            teamSettingServiceStub.fetchTeamWorkspaceStatus.resolves(true);
            utilServiceStub.getUserDefaultSetting.returns(defaultUserSettingStub);
            utilServiceStub.hash.returns(userStub.hashedPassword);
            profilesServiceStub._create.resolves(profileStub);

            teamServiceStub._create.resolves(teamStub);
            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);
            timeUtilServiceStub.getDefaultAvailableTimes.returns(availabilityBodyStub.availableTimes);
            utilServiceStub.getDefaultAvailabilityName.returns(availabilityStub.name);
            availabilityServiceStub._create.resolves(availabilityStub);

            utilServiceStub.getDefaultEvent.returns(defaultEventStub);
            eventsServiceStub._create.resolves(defaultEventStub);
            eventGroupRepositoryStub.save.resolves(eventGroupStub);

            const {
                createdUser,
                createdProfile,
                createdTeam
            } = await service._createUser(
                datasourceMock as EntityManager,
                userStub,
                profileStub.name as string,
                languageDummy,
                defaultUserSettingStub.preferredTimezone,
                {
                    plainPassword,
                    emailVerification: true,
                    alreadySignedUpUserCheck: false,
                    alreadySignedUpUserCheckByPhone: true
                }
            );

            expect(verificationServiceStub.isVerifiedUser.called).true;
            expect(searchStub.called).true;
            expect(teamServiceStub._create.called).true;
            expect(userRepositoryStub.create.called).true;
            expect(teamSettingServiceStub.fetchTeamWorkspaceStatus.called).true;
            expect(utilServiceStub.getUserDefaultSetting.called).true;
            expect(utilServiceStub.hash.called).true;
            expect(profilesServiceStub._create.called).true;

            expect(userRepositoryStub.save.called).true;
            expect(utilServiceStub.getDefaultEvent.called).true;
            expect(timeUtilServiceStub.getDefaultAvailableTimes.called).true;
            expect(utilServiceStub.getDefaultAvailabilityName.called).true;
            expect(availabilityServiceStub._create.called).true;
            expect(eventsServiceStub._create.called).true;
            expect(eventGroupRepositoryStub.save.called).true;

            expect(createdUser).ok;
            expect(createdProfile).ok;
            expect(createdUser.email).not.contains('@');
            expect(createdUser.phone).ok;
            expect(createdUser.phone).equals(phoneNumberMock);
            expect(createdTeam.teamSetting.workspace).contains(expectedWorkspace);
        });

        it('should be not created user with phone number when user is already exist', async () => {
            const timezoneMock = stubOne(UserSetting).preferredTimezone;
            const alreadySignedUpUserProfile = stubOne(Profile, {
                name: 'foo',
                default: true
            });
            const alreadySignedUpUser = stubOne(User, {
                profiles: [alreadySignedUpUserProfile]
            });
            const plainPasswordDummy = 'test';
            const languageDummy = Language.ENGLISH;
            serviceSandbox.stub(service, 'search').resolves([alreadySignedUpUser]);

            const userStub = stubOne(User);
            const profileNameMock = 'bar';

            await expect(
                service._createUser(
                    datasourceMock as EntityManager,
                    userStub,
                    profileNameMock,
                    languageDummy,
                    timezoneMock,
                    {
                        plainPassword: plainPasswordDummy,
                        emailVerification: false,
                        alreadySignedUpUserCheckByPhone: true
                    })
            ).rejectedWith(BadRequestException);
        });

    });

    describe('Test user creating by _createUserWithVerificationByEmail', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            syncdayRedisServiceStub.setEmailVerificationStatus.reset();
            syncdayRedisServiceStub.getEmailVerification.reset();

            serviceSandbox.reset();
            serviceSandbox.restore();
            utilServiceStub.comparePassword.reset();

            notificationsServiceStub.sendWelcomeEmailForNewUser.reset();
        });

        after(() => {
            serviceSandbox.restore();
        });

        it('should be created a user with email by _createUserWithVerificationByEmail when user is not exist', async () => {
            const emailMock = TestMockUtil.faker.internet.email();

            const tempUserStub = testMockUtil.getTemporaryUser();
            const userSettingStub = stubOne(UserSetting);
            const teamSettingStub = stubOne(TeamSetting);
            const userStub = stubOne(User, {
                userSetting: userSettingStub
            });
            const profileStub = stubOne(Profile);
            const teamStub = stubOne(Team, {
                teamSetting: teamSettingStub
            });

            const verificationStub = testMockUtil.getVerificationMock();
            syncdayRedisServiceStub.getEmailVerification.resolves(verificationStub);
            syncdayRedisServiceStub.getTemporaryUser.resolves(tempUserStub);

            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);

            serviceSandbox.stub(service, '_createUser').resolves({
                createdUser: userStub,
                createdProfile: profileStub,
                createdTeam: teamStub
            });

            profilesServiceStub._createInvitedProfiles.returns(of([profileStub]));
            profilesServiceStub.completeInvitation.returns(of(true));
            notificationsServiceStub.sendWelcomeEmailForNewUser.resolves(true);

            const { createdUser } = (await service._createUserWithVerificationByEmail(
                emailMock,
                verificationStub.verificationCode,
                userSettingStub.preferredTimezone
            ));

            expect(syncdayRedisServiceStub.setEmailVerificationStatus.called).true;
            expect(syncdayRedisServiceStub.getEmailVerification.called).true;

            expect(createdUser).ok;
            expect(createdUser.id).equals(userStub.id);

            expect(profilesServiceStub._createInvitedProfiles.called).ok;
            expect(profilesServiceStub.completeInvitation.called).ok;
            expect(notificationsServiceStub.sendWelcomeEmailForNewUser.called).ok;
        });

        it('should be not created a user when email verification code is not matched', async () => {
            const emailMock = TestMockUtil.faker.internet.email();
            const timezoneMcok = stubOne(UserSetting).preferredTimezone;
            const verificationCodeMock = '1423';

            syncdayRedisServiceStub.getEmailVerification.resolves(null);

            serviceSandbox.stub(service, '_createUser');

            await expect(
                service._createUserWithVerificationByEmail(emailMock, verificationCodeMock, timezoneMcok)
            ).rejectedWith(EmailVertificationFailException);

            expect(syncdayRedisServiceStub.getEmailVerification.called).true;
            expect(syncdayRedisServiceStub.setEmailVerificationStatus.called).false;
        });
    });

    describe('Test creating user by _createUserWithVerificationByPhoneNumber', () => {
        let serviceSandbox: sinon.SinonSandbox;

        let _createUserStub: sinon.SinonStub;

        let userStub: User;
        let teamStub: Team;
        let profileStub: Profile;

        let invitiedProfileStub: Profile;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            profileStub = stubOne(Profile);
            teamStub = stubOne(Team);
            userStub = stubOne(User, {
                profiles: []
            });

            _createUserStub = serviceSandbox.stub(service, '_createUser').resolves({
                createdProfile: profileStub,
                createdTeam: teamStub,
                createdUser: userStub
            });

            invitiedProfileStub = stubOne(Profile);
            profilesServiceStub._createInvitedProfiles.returns(of([invitiedProfileStub]));
            profilesServiceStub.completeInvitation.returns(of(true));
        });

        afterEach(() => {
            syncdayRedisServiceStub.getPhoneVerificationStatus.reset();

            userRepositoryStub.create.reset();
            _createUserStub.reset();

            profilesServiceStub._createInvitedProfiles.reset();
            profilesServiceStub.completeInvitation.reset();

            serviceSandbox.reset();
            serviceSandbox.restore();
        });

        [
            {
                description: 'should be created an user with phone number by _createUserWithVerificationByPhoneNumber when user is not exist'
            }
        ].forEach(function({
            description
        }) {

            it(description, async () => {

                const phoneNumberMock = TestMockUtil.faker.phone.number('+8210########');
                const plainPasswordMock = TestMockUtil.faker.internet.password();
                const nameMock = TestMockUtil.faker.name.firstName();
                const uuidMock = TestMockUtil.faker.datatype.uuid();
                const timezoneMock = stubOne(UserSetting).preferredTimezone;
                const language = Language.KOREAN;

                syncdayRedisServiceStub.getPhoneVerificationStatus.resolves(true);

                const {
                    createdProfile,
                    createdTeam,
                    createdUser
                } = await firstValueFrom(service._createUserWithVerificationByPhoneNumber(
                    phoneNumberMock,
                    plainPasswordMock,
                    nameMock,
                    uuidMock,
                    timezoneMock,
                    language
                ));

                expect(createdProfile).ok;
                expect(createdTeam).ok;
                expect(createdUser).ok;
                expect(createdUser.id).equals(userStub.id);
            });
        });

        it('should be not created a user when phone verification status is false', async () => {

            const phoneNumberMock = TestMockUtil.faker.phone.number('+8210########');
            const plainPasswordMock = TestMockUtil.faker.internet.password();
            const nameMock = TestMockUtil.faker.name.firstName();
            const uuidMock = TestMockUtil.faker.datatype.uuid();
            const timezoneMock = stubOne(UserSetting).preferredTimezone;
            const language = Language.KOREAN;

            syncdayRedisServiceStub.getPhoneVerificationStatus.resolves(false);

            await expect(firstValueFrom(service._createUserWithVerificationByPhoneNumber(
                phoneNumberMock,
                plainPasswordMock,
                nameMock,
                uuidMock,
                timezoneMock,
                language
            ))).rejectedWith(PhoneVertificationFailException);
        });
    });

    // TODO: recover user delete spec
    describe.skip('Test User delete', () => {
        afterEach(() => {
            userRepositoryStub.findOneOrFail.reset();
            eventGroupRepositoryStub.delete.reset();
            userRepositoryStub.delete.reset();
        });

        it('should be removed a user', async () => {
            const eventDetail = stubOne(EventDetail);
            const events = stub(Event, 2, {
                eventDetail
            });
            const eventGroup = stubOne(EventGroup,{
                events
            });

            const availabilities = stub(Availability);
            const googleIntergrations = stub(GoogleIntegration);
            const teamSettingStub = stubOne(TeamSetting);
            const team = stubOne(Team, {
                eventGroup: [eventGroup],
                teamSetting: teamSettingStub
            });
            const profile = stubOne(Profile, {
                team,
                googleIntergrations,
                availabilities
            });
            const userSetting = stubOne(UserSetting);

            const userStub = stubOne(User, {
                profiles: [profile],
                userSetting
            });

            const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

            userRepositoryStub.findOneOrFail.resolves(userStub);

            const repositoryStubs = [
                eventGroupRepositoryStub,
                userRepositoryStub
            ];

            repositoryStubs.forEach((_repositoryStub) => {
                _repositoryStub.delete.resolves(deleteResultStub);
            });

            const deleteResult = await service.deleteUser(userStub.id);
            expect(deleteResult).true;
            expect(availabilityRedisRepositoryStub.deleteAll.called).true;
            expect(eventsRedisRepositoryStub.removeEventDetails.called).true;

            repositoryStubs.forEach((_repositoryStub) => {
                expect(_repositoryStub.delete.called).true;
            });
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
            utilServiceStub.comparePassword.reset();
        });

        after(() => {
            serviceSandbox.restore();
        });

        it('should be passed email validation when user is exist', async () => {
            const plainPassword = 'thisisUserPlainPassword';

            const userStub = stubOne(User, {
                hashedPassword: plainPassword
            });

            serviceSandbox.stub(service, 'findUserByLocalAuth').resolves(userStub);
            utilServiceStub.comparePassword.resolves(true);

            const validatedUserOrNull = await service.validateEmailAndPassword(
                userStub.email as string,
                plainPassword
            );

            expect(validatedUserOrNull).ok;
        });

        it('should be not passed email validation when user is not exist', async () => {
            const dummy = 'thisisUserPlainPassword';

            const userStub = stubOne(User);

            serviceSandbox.stub(service, 'findUserByLocalAuth').resolves(null);

            const validatedUserOrNull = await service.validateEmailAndPassword(
                userStub.email as string,
                dummy
            );

            expect(validatedUserOrNull).not.ok;
        });

        it('should be not passed password validation when user hashed password is not same to requested password', async () => {
            const dummy = 'thisisUserPlainPassword';

            const userStub = stubOne(User);

            serviceSandbox.stub(service, 'findUserByLocalAuth').resolves(userStub);
            utilServiceStub.comparePassword.resolves(false);

            const validatedUserOrNull = await service.validateEmailAndPassword(
                userStub.email as string,
                dummy
            );

            expect(validatedUserOrNull).not.ok;
        });
    });

    describe('Test user phone update', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            syncdayRedisServiceStub.getPhoneVerification.reset();
            syncdayRedisServiceStub.getPhoneVerificationStatus.reset();

            verificationServiceStub.isValidPhoneVerification.reset();
            userRepositoryStub.update.reset();

            serviceSandbox.reset();
            serviceSandbox.restore();
        });

        it('should be updated phone with valid verification'), async () => {
            const userIdMock = 1;
            const userUUIDMock = 'abcd';
            const updatePhoneWithVerificationDtoMock = {
                phone: TestMockUtil.faker.phone.number(),
                verificationCode:'1423'
            } as UpdatePhoneWithVerificationDto;

            verificationServiceStub.isValidPhoneVerification.resolves(true);

            const isUpdated = await service.updateUserPhone(userIdMock, userUUIDMock, updatePhoneWithVerificationDtoMock);

            expect(isUpdated).true;
            expect(verificationServiceStub.isValidPhoneVerification.called).true;
            expect(syncdayRedisServiceStub.setPhoneVerificationStatus.called).false;
            expect(userRepositoryStub.update.called).true;
        };

        it('should be not updated a phone number when verification is not valid', async () => {
            const userIdMock = 1;
            const userUUIDMock = 'abcd';
            const updatePhoneWithVerificationDtoMock = {
                phone: TestMockUtil.faker.phone.number(),
                verificationCode:'1423'
            } as UpdatePhoneWithVerificationDto;

            verificationServiceStub.isValidPhoneVerification.resolves(false);

            await expect(
                service.updateUserPhone(userIdMock, userUUIDMock, updatePhoneWithVerificationDtoMock)
            ).rejectedWith(PhoneVertificationFailException);

            expect(verificationServiceStub.isValidPhoneVerification.called).true;
            expect(syncdayRedisServiceStub.setPhoneVerificationStatus.called).false;
            expect(userRepositoryStub.update.called).false;
        });
    });
});
