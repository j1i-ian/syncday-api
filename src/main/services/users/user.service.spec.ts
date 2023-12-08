import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { Availability } from '@core/entities/availability/availability.entity';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
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
    let verificationServiceStub: sinon.SinonStubbedInstance<VerificationService>;
    let teamSettingServiceStub: sinon.SinonStubbedInstance<TeamSettingService>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let eventsRedisRepositoryStub: sinon.SinonStubbedInstance<EventsRedisRepository>;
    let googleIntegrationsServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationsService>;
    let oauth2AccountsServiceStub: sinon.SinonStubbedInstance<OAuth2AccountsService>;
    let notificationsServiceStub: sinon.SinonStubbedInstance<NotificationsService>;
    let availabilityRedisRepositoryStub: sinon.SinonStubbedInstance<AvailabilityRedisRepository>;
    let userRepositoryStub: sinon.SinonStubbedInstance<Repository<User>>;
    let profileRepositoryStub: sinon.SinonStubbedInstance<Repository<Profile>>;
    let teamRepositoryStub: sinon.SinonStubbedInstance<Repository<Team>>;

    let userSettingRepositoryStub: sinon.SinonStubbedInstance<Repository<UserSetting>>;
    let eventGroupRepositoryStub: sinon.SinonStubbedInstance<Repository<EventGroup>>;
    let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;
    let eventDetaiRepositoryStub: sinon.SinonStubbedInstance<Repository<EventDetail>>;
    let availabilityRepositoryStub: sinon.SinonStubbedInstance<Repository<Availability>>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    before(async () => {
        verificationServiceStub = sinon.createStubInstance(VerificationService);
        teamSettingServiceStub = sinon.createStubInstance(TeamSettingService);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        availabilityRedisRepositoryStub = sinon.createStubInstance(AvailabilityRedisRepository);
        googleIntegrationsServiceStub = sinon.createStubInstance(GoogleIntegrationsService);
        oauth2AccountsServiceStub = sinon.createStubInstance(OAuth2AccountsService);
        notificationsServiceStub = sinon.createStubInstance(NotificationsService);
        eventsRedisRepositoryStub = sinon.createStubInstance(EventsRedisRepository);
        utilServiceStub = sinon.createStubInstance(UtilService);

        userRepositoryStub = sinon.createStubInstance<Repository<User>>(Repository);
        profileRepositoryStub = sinon.createStubInstance<Repository<Profile>>(Repository);
        teamRepositoryStub = sinon.createStubInstance<Repository<Team>>(Repository);
        userSettingRepositoryStub = sinon.createStubInstance<Repository<UserSetting>>(Repository);
        eventGroupRepositoryStub = sinon.createStubInstance<Repository<EventGroup>>(Repository);
        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);
        eventDetaiRepositoryStub = sinon.createStubInstance<Repository<EventDetail>>(Repository);
        availabilityRepositoryStub = sinon.createStubInstance<Repository<Availability>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: TeamSettingService,
                    useValue: teamSettingServiceStub
                },
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                {
                    provide: AvailabilityRedisRepository,
                    useValue: availabilityRedisRepositoryStub
                },
                {
                    provide: GoogleIntegrationsService,
                    useValue: googleIntegrationsServiceStub
                },
                {
                    provide: OAuth2AccountsService,
                    useValue: oauth2AccountsServiceStub
                },
                {
                    provide: EventsRedisRepository,
                    useValue: eventsRedisRepositoryStub
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
                    provide: NotificationsService,
                    useValue: notificationsServiceStub
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: userRepositoryStub
                },
                {
                    provide: getRepositoryToken(Profile),
                    useValue: profileRepositoryStub
                },
                {
                    provide: getRepositoryToken(Team),
                    useValue: teamRepositoryStub
                },
                {
                    provide: getRepositoryToken(UserSetting),
                    useValue: userSettingRepositoryStub
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
                    provide: getRepositoryToken(EventDetail),
                    useValue: eventDetaiRepositoryStub
                },
                {
                    provide: getRepositoryToken(Availability),
                    useValue: availabilityRepositoryStub
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

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {

            verificationServiceStub.isVerifiedUser.reset();

            userRepositoryStub.create.reset();
            userRepositoryStub.save.reset();
            teamSettingServiceStub.fetchTeamWorkspaceStatus.reset();

            verificationServiceStub.isVerifiedUser.reset();
            availabilityRepositoryStub.save.reset();
            availabilityRedisRepositoryStub.save.reset();

            utilServiceStub.getUserDefaultSetting.reset();
            utilServiceStub.hash.reset();
            utilServiceStub.getDefaultEvent.reset();
            utilServiceStub.getDefaultAvailabilityName.reset();

            eventGroupRepositoryStub.save.reset();
            eventsRedisRepositoryStub.setEventLinkSetStatus.reset();
            eventsRedisRepositoryStub.save.reset();

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
            const eventDetailStub = stubOne(EventDetail);
            const defaultEventStub = stubOne(Event, {
                eventDetail: eventDetailStub
            });
            const eventGroupStub = stubOne(EventGroup, {
                events: [defaultEventStub]
            });
            const availabilityStub = stubOne(Availability);
            const availabilityBodyStub = testMockUtil.getAvailabilityBodyMock();

            const findUserByEmailStub = serviceSandbox.stub(service, 'findUserByEmail');

            verificationServiceStub.isVerifiedUser.resolves(true);
            findUserByEmailStub.resolves(null);

            userRepositoryStub.create.returns(userStub);
            profileRepositoryStub.create.returns(profileStub);
            teamRepositoryStub.create.returns(teamStub);
            teamSettingServiceStub.fetchTeamWorkspaceStatus.resolves(true);
            utilServiceStub.getUserDefaultSetting.returns(defaultUserSettingStub);
            utilServiceStub.hash.returns(userStub.hashedPassword);

            userRepositoryStub.save.resolves(userStub);
            profileRepositoryStub.save.resolves(profileStub);
            teamRepositoryStub.save.resolves(teamStub);
            utilServiceStub.getDefaultEvent.returns(defaultEventStub);
            utilServiceStub.getDefaultAvailabilityName.returns(availabilityStub.name);
            availabilityRepositoryStub.save.resolves(availabilityStub);
            availabilityRedisRepositoryStub.save.resolves(availabilityBodyStub);
            eventGroupRepositoryStub.save.resolves(eventGroupStub);
            eventsRedisRepositoryStub.setEventLinkSetStatus.resolves(true);
            eventsRedisRepositoryStub.save.resolves(eventDetailStub);

            const {
                createdUser,
                createdProfile,
                createdTeam
            } = await service._createUser(
                datasourceMock as EntityManager,
                userStub,
                profileStub,
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
            expect(userRepositoryStub.create.called).true;
            expect(profileRepositoryStub.create.called).true;
            expect(teamRepositoryStub.create.called).true;
            expect(teamSettingServiceStub.fetchTeamWorkspaceStatus.called).true;
            expect(utilServiceStub.getUserDefaultSetting.called).true;
            expect(utilServiceStub.hash.called).true;
            expect(userRepositoryStub.save.called).true;
            expect(profileRepositoryStub.save.called).true;
            expect(teamRepositoryStub.save.called).true;
            expect(utilServiceStub.getDefaultEvent.called).true;
            expect(utilServiceStub.getDefaultAvailabilityName.called).true;
            expect(availabilityRepositoryStub.save.called).true;
            expect(availabilityRedisRepositoryStub.save.called).true;
            expect(eventGroupRepositoryStub.save.called).true;
            expect(eventsRedisRepositoryStub.setEventLinkSetStatus.called).true;
            expect(eventsRedisRepositoryStub.save.called).true;

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
            serviceSandbox.stub(service, 'findUserByEmail').resolves(alreadySignedUpUser);

            const userStub = stubOne(User);
            const profileStub = stubOne(Profile, {
                name: 'bar'
            });

            await expect(
                service._createUser(
                    datasourceMock as EntityManager,
                    userStub,
                    profileStub,
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
            const profileStub = stubOne(Profile);
            const plainPasswordDummy = 'test';
            const languageDummy = Language.ENGLISH;

            verificationServiceStub.isVerifiedUser.resolves(false);

            userRepositoryStub.create.returns(userStub);
            userRepositoryStub.save.resolves(userStub);

            await expect(
                service._createUser(
                    datasourceMock as EntityManager,
                    userStub,
                    profileStub,
                    languageDummy,
                    timezoneMock,
                    {
                        plainPassword: plainPasswordDummy,
                        emailVerification: true
                    }
                )
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
                utilServiceStub.comparePassword.reset();

                notificationsServiceStub.sendWelcomeEmailForNewUser.reset();
            });

            after(() => {
                serviceSandbox.restore();
            });

            it('should be verified when email and verification is matched each other', async () => {
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

                notificationsServiceStub.sendWelcomeEmailForNewUser.resolves(true);

                const createdUser = (await service.createUserWithVerificationByEmail(
                    emailMock,
                    verificationStub.verificationCode,
                    userSettingStub.preferredTimezone
                )) as User;

                expect(syncdayRedisServiceStub.setEmailVerificationStatus.called).true;
                expect(syncdayRedisServiceStub.getEmailVerification.called).true;

                expect(createdUser).ok;
                expect(createdUser.id).equals(userStub.id);

                expect(notificationsServiceStub.sendWelcomeEmailForNewUser.called).ok;
            });

            it('should be not verified when email and verification is not matched', async () => {
                const emailMock = TestMockUtil.faker.internet.email();
                const timezoneMcok = stubOne(UserSetting).preferredTimezone;
                const verificationCodeMock = '1423';

                syncdayRedisServiceStub.getEmailVerification.resolves(null);

                serviceSandbox.stub(service, '_createUser');

                await expect(
                    service.createUserWithVerificationByEmail(emailMock, verificationCodeMock, timezoneMcok)
                ).rejectedWith(EmailVertificationFailException);

                expect(syncdayRedisServiceStub.getEmailVerification.called).true;
                expect(syncdayRedisServiceStub.setEmailVerificationStatus.called).false;
            });
        });
    });

    describe('Test User delete', () => {
        afterEach(() => {
            userRepositoryStub.findOneOrFail.reset();
            eventDetaiRepositoryStub.delete.reset();
            eventRepositoryStub.delete.reset();
            eventGroupRepositoryStub.delete.reset();
            availabilityRepositoryStub.delete.reset();
            userSettingRepositoryStub.delete.reset();
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
                availabilities,
                eventGroup: [eventGroup],
                teamSetting: teamSettingStub
            });
            const profile = stubOne(Profile, {
                team,
                googleIntergrations
            });
            const userSetting = stubOne(UserSetting);

            const userStub = stubOne(User, {
                profiles: [profile],
                userSetting
            });

            const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

            userRepositoryStub.findOneOrFail.resolves(userStub);

            const repositoryStubs = [
                eventDetaiRepositoryStub,
                eventRepositoryStub,
                eventGroupRepositoryStub,
                availabilityRepositoryStub,
                userSettingRepositoryStub,
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

            serviceSandbox.stub(service, 'findUserByEmail').resolves(userStub);
            utilServiceStub.comparePassword.resolves(true);

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
            utilServiceStub.comparePassword.resolves(false);

            const validatedUserOrNull = await service.validateEmailAndPassword(
                userStub.email,
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
            serviceSandbox.reset();
            serviceSandbox.restore();
            syncdayRedisServiceStub.getPhoneVerification.reset();
            syncdayRedisServiceStub.getPhoneVerificationStatus.reset();
        });
        it('should be updated phone with verificated'), async () => {
            const userIdMock = 1;
            const updatePhoneWithVerificationDtoMock = {
                phone: TestMockUtil.faker.phone.number(),
                verificationCode:'1423'
            } as UpdatePhoneWithVerificationDto;

            const verificationStub = testMockUtil.getVerificationMock();
            syncdayRedisServiceStub.getPhoneVerification.resolves(verificationStub);

            await expect(
                service.updateUserPhone(userIdMock, updatePhoneWithVerificationDtoMock)
            ).rejectedWith(PhoneVertificationFailException);

            expect(syncdayRedisServiceStub.getPhoneVerification.called).true;
            expect(syncdayRedisServiceStub.setPhoneVerificationStatus.called).false;
        };

        it('should be not verified when phone and verificationCode is not matched', async () => {
            const userIdMock = 1;
            const updatePhoneWithVerificationDtoMock = {
                phone: TestMockUtil.faker.phone.number(),
                verificationCode:'1423'
            } as UpdatePhoneWithVerificationDto;

            syncdayRedisServiceStub.getPhoneVerification.resolves(null);

            await expect(
                service.updateUserPhone(userIdMock, updatePhoneWithVerificationDtoMock)
            ).rejectedWith(PhoneVertificationFailException);

            expect(syncdayRedisServiceStub.getPhoneVerification.called).true;
            expect(syncdayRedisServiceStub.setPhoneVerificationStatus.called).false;
        });
    });
});
