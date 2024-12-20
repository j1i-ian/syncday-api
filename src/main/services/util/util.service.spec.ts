import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { TextTemplate } from '@core/interfaces/notifications/text-template.enum';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { ReminderType } from '@interfaces/reminders/reminder-type.enum';
import { Role } from '@interfaces/profiles/role.enum';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { HostProfile } from '@interfaces/scheduled-events/host-profile.interface';
import { Host } from '@interfaces/bookings/host';
import { EventType } from '@interfaces/events/event-type.enum';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { ScheduledEventNotification } from '@entity/scheduled-events/scheduled-event-notification.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { NotificationTarget } from '@entity/scheduled-events/notification-target.enum';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { Weekday } from '@entity/availability/weekday.enum';
import { Team } from '@entity/teams/team.entity';
import { ScheduledTimeset } from '@entity/scheduled-events/scheduled-timeset.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { Language } from '../../enums/language.enum';
import { faker } from '@faker-js/faker';
import { TestMockUtil } from '@test/test-mock-util';
import { InternalBootpayException } from '@exceptions/internal-bootpay.exception';
import { UtilService } from './util.service';

interface RoleUpdateTestParameters {
    authRole: Role;
    desireRole: Role;
}

type BasicSearchOption = Partial<Pick<AppJwtPayload, 'teamId' | 'teamUUID' | 'id' | 'userId'> & ScheduledEventSearchOption>;

describe('UtilService', () => {
    let service: UtilService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;

    beforeEach(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UtilService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                }
            ]
        }).compile();

        service = module.get<UtilService>(UtilService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Host brand image, logo, name patch test', () => {

        [
            {
                description: 'should be patched the team brand image, logo, name as host for the alone team without event type',
                teamMock: stubOne(Team, {
                    memberCount: 1
                }),
                teamSettingMock: stubOne(TeamSetting),
                mainProfileMock: stubOne(Profile),
                eventTypeMock: null,
                evaluateExpectations: (
                    teamMock: Team,
                    teamSettingMock: TeamSetting,
                    _mainProfileMock: Profile | null,
                    actualHost: Host
                ) => {

                    expect(actualHost.brandImagePath).equals(teamSettingMock.brandImagePath);
                    expect(actualHost.name).equals(teamMock.name);
                    expect(actualHost.logo).equals(teamMock.logo);
                }
            },
            {
                description: 'should be patched the team brand image, logo, name as host if main profile is not given',
                teamMock: stubOne(Team, {
                    memberCount: 1
                }),
                teamSettingMock: stubOne(TeamSetting),
                mainProfileMock: null,
                eventTypeMock: null,
                evaluateExpectations: (
                    teamMock: Team,
                    teamSettingMock: TeamSetting,
                    _mainProfileMock: Profile | null,
                    actualHost: Host
                ) => {

                    expect(actualHost.brandImagePath).equals(teamSettingMock.brandImagePath);
                    expect(actualHost.name).equals(teamMock.name);
                    expect(actualHost.logo).equals(teamMock.logo);
                }
            },
            {
                description: 'should be patched the team brand image, logo, name as host without event type',
                teamMock: stubOne(Team, {
                    memberCount: 2
                }),
                teamSettingMock: stubOne(TeamSetting),
                mainProfileMock: stubOne(Profile),
                eventTypeMock: null,
                evaluateExpectations: (
                    teamMock: Team,
                    teamSettingMock: TeamSetting,
                    _mainProfileMock: Profile | null,
                    actualHost: Host
                ) => {

                    expect(actualHost.uuid).equals(teamMock.uuid);
                    expect(actualHost.brandImagePath).equals(teamSettingMock.brandImagePath);
                    expect(actualHost.name).equals(teamMock.name);
                    expect(actualHost.logo).equals(teamMock.logo);
                }
            },
            {
                description: 'should be patched the team brand image, logo, name as host for alone team',
                teamMock: stubOne(Team, {
                    memberCount: 1
                }),
                teamSettingMock: stubOne(TeamSetting),
                mainProfileMock: stubOne(Profile),
                eventTypeMock: EventType.ONE_ON_ONE,
                evaluateExpectations: (
                    teamMock: Team,
                    teamSettingMock: TeamSetting,
                    _mainProfileMock: Profile | null,
                    actualHost: Host
                ) => {

                    expect(actualHost.uuid).equals(teamMock.uuid);
                    expect(actualHost.brandImagePath).equals(teamSettingMock.brandImagePath);
                    expect(actualHost.name).equals(teamMock.name);
                    expect(actualHost.logo).equals(teamMock.logo);
                }
            },
            {
                description: 'should be patched the team brand image, logo, name as host for alone team although event type is collective',
                teamMock: stubOne(Team, {
                    memberCount: 1
                }),
                teamSettingMock: stubOne(TeamSetting),
                mainProfileMock: stubOne(Profile),
                eventTypeMock: EventType.COLLECTIVE,
                evaluateExpectations: (
                    teamMock: Team,
                    teamSettingMock: TeamSetting,
                    _mainProfileMock: Profile | null,
                    actualHost: Host
                ) => {

                    expect(actualHost.uuid).equals(teamMock.uuid);
                    expect(actualHost.brandImagePath).equals(teamSettingMock.brandImagePath);
                    expect(actualHost.name).equals(teamMock.name);
                    expect(actualHost.logo).equals(teamMock.logo);
                }
            },
            {
                description: 'The it should be patched the team brand image, profile image, and name, to reflect the host for teams with two or more members and event type is one on one',
                teamMock: stubOne(Team, {
                    memberCount: 2
                }),
                teamSettingMock: stubOne(TeamSetting),
                mainProfileMock: stubOne(Profile),
                eventTypeMock: EventType.ONE_ON_ONE,
                evaluateExpectations: (
                    teamMock: Team,
                    teamSettingMock: TeamSetting,
                    mainProfileMock: Profile,
                    actualHost: Host
                ) => {

                    expect(actualHost.uuid).equals(teamMock.uuid);
                    expect(actualHost.brandImagePath).equals(teamSettingMock.brandImagePath);
                    expect(actualHost.name).equals(mainProfileMock.name);
                    expect(actualHost.logo).equals(mainProfileMock.image);
                }
            },
            {
                description: 'The it should be patched the team brand image, team logo and team name, to reflect the host for teams with two or more members and event type is collective',
                teamMock: stubOne(Team, {
                    memberCount: 2
                }),
                teamSettingMock: stubOne(TeamSetting),
                mainProfileMock: stubOne(Profile),
                eventTypeMock: EventType.COLLECTIVE,
                evaluateExpectations: (
                    teamMock: Team,
                    teamSettingMock: TeamSetting,
                    _mainProfileMock: Profile | null,
                    actualHost: Host
                ) => {

                    expect(actualHost.uuid).equals(teamMock.uuid);
                    expect(actualHost.brandImagePath).equals(teamSettingMock.brandImagePath);
                    expect(actualHost.name).equals(teamMock.name);
                    expect(actualHost.logo).equals(teamMock.logo);
                }
            }
        ].forEach(function({
            description,
            teamMock,
            teamSettingMock,
            mainProfileMock,
            eventTypeMock,
            evaluateExpectations
        }) {
            it(description, () => {

                const actualHost = service.patchHost(
                    teamMock,
                    teamSettingMock,
                    mainProfileMock,
                    eventTypeMock
                );

                evaluateExpectations(
                    teamMock,
                    teamSettingMock,
                    mainProfileMock as Profile,
                    actualHost
                );
            });
        });
    });

    describe('Converting to the profile Test', () => {

        [
            {
                description: 'should be converted to the profile from email',
                emailOrPhone: 'alan@sync.day',
                invitationDataType: 'email'
            },
            {
                description: 'should be converted to the profile from phone number',
                emailOrPhone: '+821012345678',
                invitationDataType: 'phone'
            }
        ].forEach(function({
            description,
            emailOrPhone,
            invitationDataType
        }) {
            it(description, () => {
                const convertedProfile = service.convertInvitationToProfile(emailOrPhone);

                expect(convertedProfile).ok;
                expect(convertedProfile.id).is.equals(-1);

                if (invitationDataType === 'email') {
                    expect(convertedProfile.user.email).equals(emailOrPhone);
                    expect(convertedProfile.user.phone).not.ok;
                } else {
                    expect(convertedProfile.user.email).not.ok;
                    expect(convertedProfile.user.phone).equals(emailOrPhone);
                }
            });
        });
    });

    it('should be generated default available times', () => {

        const availableTimes = service.getDefaultAvailableTimes();

        expect(availableTimes).ok;
        expect(availableTimes.length).greaterThan(0);

        const mondayAvailableTime = availableTimes[0];
        expect(mondayAvailableTime).ok;
        expect(mondayAvailableTime.day).equals(Weekday.MONDAY);
        expect(mondayAvailableTime.timeRanges.length).equals(1);
        expect(mondayAvailableTime.timeRanges[0].startTime).equals('09:00:00');
    });

    describe('Search Option Patching Test', () => {

        (
            [
                {
                    description: 'should be ensured that the team ID option is patched in the absence of query parameters, provided the user possesses member permissions',
                    searchOptionMock: { teamId: undefined, profileId: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, profileId: 2, userId: 3 }
                },
                {
                    description: 'should be ensured that the team ID option is patched in the absence of query parameters, provided the user possesses manager permissions',
                    searchOptionMock: { teamId: undefined, profileId: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MANAGER] },
                    expected: { teamId: 1, profileId: undefined, userId: undefined }
                },
                {
                    description: 'should be ensured that the team ID option is patched in the absence of query parameters, provided the user possesses owner permissions',
                    searchOptionMock: { teamId: undefined, profileId: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.OWNER] },
                    expected: { teamId: 1, profileId: undefined, userId: undefined }
                },
                {
                    description: 'should be ensured that the user id option is patched with team id when user id is not owned',
                    searchOptionMock: { teamId: undefined, profileId: undefined, userId: '3' },
                    authProfileMock: { teamId: 1, id: 2, userId: 2, roles: [Role.MANAGER] },
                    expected: { teamId: 1, profileId: undefined, userId: 3 }
                },
                {
                    description: 'should be ensured that the user id option is patched without team id when user id is owned',
                    searchOptionMock: { teamId: undefined, profileId: undefined, userId: '2' },
                    authProfileMock: { teamId: 1, id: 2, userId: 2, roles: [Role.MANAGER] },
                    expected: { teamId: undefined, profileId: undefined, userId: 2 }
                },
                {
                    description: 'should be ensured that the team id search option is patched when the team id is queried',
                    searchOptionMock: { teamId: 1, profileId: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, profileId: undefined, userId: undefined }
                },
                {
                    description: 'should be ensured that the team id search option is patched when the team id is queried with wrong value fixing automatically',
                    searchOptionMock: { teamId: 4, profileId: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, profileId: undefined, userId: undefined }
                },
                {
                    description: 'should be ensured that the user id search option is patched when user id is queried with wrong value fixing automatically',
                    searchOptionMock: { teamId: undefined, profileId: undefined, userId: 3 },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, profileId: 2, userId: 3 }
                },
                {
                    description: 'should be ensured that the profile id search option is patched when profile id is queried with wrong value fixing automatically',
                    searchOptionMock: { teamId: 6, profileId: 7, userId: 8 },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, profileId: 2, userId: 3 }
                },
                {
                    description: 'should be ensured that user and profile id search option as query params are patched when profile id is queried and user has a permission',
                    searchOptionMock: { teamId: 6, iprofileIdd: 7, userId: 8 },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MANAGER] },
                    expected: { teamId: 1, profileId: 7, userId: 8 }
                },
                {
                    description: 'should be ensured that page, take, since, until option should be parsed to integer value',
                    searchOptionMock: { page: '1', take: '2', since: '1696836098843', until: '1707463298843' },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MANAGER] },
                    expected: { page: 1, take: 2, since: 1696836098843, until: 1707463298843, teamId: 1 }
                },
                {
                    description: 'should be ensured that own user id search option without any team option for searching new profiles',
                    searchOptionMock: { userId: '2' },
                    authProfileMock: { teamId: 1, id: 2, userId: 2, roles: [Role.MANAGER] },
                    expected: { userId: 2 }
                }
            ] as Array<{
                description: string;
                searchOptionMock: BasicSearchOption;
                authProfileMock: AppJwtPayload;
                expected: BasicSearchOption;
            }>
        ).forEach(function({
            description,
            searchOptionMock,
            authProfileMock,
            expected
        }) {

            it(description, () => {

                const parsedSearchOption = service.patchSearchOption(
                    searchOptionMock,
                    authProfileMock
                );
                expect(parsedSearchOption).ok;

                const {
                    id: expectedProfileId,
                    teamId: expectedTeamId,
                    teamUUID: expectedTeamUUID,
                    userId: expectedUserId
                } = expected;

                expect(parsedSearchOption.teamId).equals(expectedTeamId);
                expect(parsedSearchOption.teamUUID).equals(expectedTeamUUID);
                expect(parsedSearchOption.id).equals(expectedProfileId);
                expect(parsedSearchOption.userId).equals(expectedUserId);
            });
        });
    });

    describe('Bootpay Exception convert Test', () => {

        it('should be converted to bootpay exception', () => {

            const errorCodeMock = 'sample';
            const messageMock = 'cancelation is already completed';
            const bootpayErrorMock = {
                error_code: errorCodeMock,
                message: messageMock
            } as InternalBootpayException;

            const convertedException = service.convertToBootpayException(bootpayErrorMock);

            expect(convertedException).ok;
            expect(convertedException.message).equals(messageMock);
            expect(convertedException.name).equals(errorCodeMock);
        });
    });

    describe('getProrationDate Test', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        it('should be got the proration date', () => {

            const teamCreateDateMock = new Date('2024-01-01');

            const nowStub = new Date('2024-02-09T14:25:44.762Z');

            // team creation date is not including in proration date
            const expectedProrationDate = 22;

            serviceSandbox.stub(Date, 'now').returns(nowStub.getTime());

            const nextPeriodDate = service.getProrationDate(teamCreateDateMock);

            expect(nextPeriodDate).equals(expectedProrationDate);
        });
    });

    describe('getNextPaymentDate Test', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        it('should be got the next payment date', () => {

            const teamCreateDateMock = new Date('2024-01-01');

            const expectedNextPaymentDate = new Date('2024-03-03');
            const nowStub = new Date('2024-02-09T14:25:44.762Z');

            serviceSandbox.stub(Date, 'now').returns(nowStub.getTime());
            serviceSandbox.useFakeTimers(nowStub);

            const nextPaymentDate = service.getNextPaymentDate(teamCreateDateMock);

            expect(nextPaymentDate.getTime()).equals(expectedNextPaymentDate.getTime());
        });
    });

    describe('Proration Test', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        it('should be calculated that the proration for an amount of 26,970, results in whole numbers of 870', () => {
            const amountMock = 26970;

            const _15daysBeforePaymentPeriodMock = new Date();
            _15daysBeforePaymentPeriodMock.setDate(_15daysBeforePaymentPeriodMock.getDate() - 15);

            const actualProration = service.getProration(
                amountMock,
                _15daysBeforePaymentPeriodMock
            );
            const teamCreationDayIsService = 1;
            const expectedProrationDate = (31 - 15 - teamCreationDayIsService);

            const expectedProration = (amountMock / 31) * expectedProrationDate;

            expect(actualProration).ok;
            expect(actualProration).equals(expectedProration);
        });

        it('should be calculated that the proration when team is created 3 month and half ago for an amount of 26,970, results in whole numbers of 870', () => {
            const amountMock = 26970;

            const _3monthAndHalfAgoPaymentPeriodMock = new Date();
            _3monthAndHalfAgoPaymentPeriodMock.setDate(_3monthAndHalfAgoPaymentPeriodMock.getDate() - 3 * 31 - 15);

            const actualProration = service.getProration(
                amountMock,
                _3monthAndHalfAgoPaymentPeriodMock
            );
            const teamCreationDayIsService = 1;
            const expectedProrationDate = (31 - 15 - teamCreationDayIsService);

            const expectedProration = (amountMock / 31) * expectedProrationDate;

            expect(actualProration).ok;
            expect(actualProration).equals(expectedProration);
        });

        it('should be calculated that the proration for #799', () => {
            const expectedProration = 650;

            const amountMock = 5000;
            const prorationDateStub = 4;

            const teamCreationDate = new Date('2024-02-16T00:24:22.909Z');

            serviceSandbox.stub(service, 'getProrationDate').returns(prorationDateStub);

            const actualProration = service.getProration(
                amountMock,
                teamCreationDate
            );

            expect(actualProration).ok;
            expect(actualProration).equals(expectedProration);
        });
    });

    describe('Conversion Test', () => {
        it('should be converted from the email invitation to a invited new team member dto', () => {
            const emailMock = 'sample@sync.day';

            const conveted = service.convertToInvitedNewTeamMember(emailMock);

            expect(conveted).ok;
            expect(conveted.email).ok;
        });

        it('should be converted from the phone invitation to a invited new team member dto', () => {
            const phoneMock = '+821012345678';

            const conveted = service.convertToInvitedNewTeamMember(phoneMock);

            expect(conveted).ok;
            expect(conveted.phone).ok;
        });
    });

    describe('Test the conversion of the update result to a boolean value', () => {

        it('should be converted to true for valid update result', () => {

            const updatedResultMock = TestMockUtil.getTypeormUpdateResultMock();

            const actual = service.convertUpdateResultToBoolean(updatedResultMock);

            expect(actual).to.be.true;

        });

        it('should be converted to false for invalid update result', () => {

            const zeroUpdatedResultMock = TestMockUtil.getTypeormUpdateResultMock(0);

            const actual = service.convertUpdateResultToBoolean(zeroUpdatedResultMock);

            expect(actual).to.be.false;
        });
    });


    describe('Test role update request validation', () => {

        [
            {
                getMessage: ({ desireRole }: RoleUpdateTestParameters) => `should be possible for the owner to update the ${desireRole} role`,
                authRoles: [Role.OWNER],
                desireRoles: [Role.MEMBER, Role.MANAGER, Role.OWNER],
                expectedResult: true
            },
            {
                getMessage: ({ authRole }: RoleUpdateTestParameters) => `should be impossible for the ${authRole} to update the owner role`,
                authRoles: [Role.MANAGER, Role.MEMBER],
                desireRoles: [Role.OWNER],
                expectedResult: false
            },
            {
                getMessage: ({ desireRole }: RoleUpdateTestParameters) => `should be possible for the manager to update the ${desireRole} role`,
                authRoles: [Role.MANAGER],
                desireRoles: [Role.MANAGER, Role.MEMBER],
                expectedResult: true
            }
        ]
            .forEach(function({
                getMessage,
                authRoles,
                desireRoles,
                expectedResult
            }) {
                authRoles.forEach((authRole) => {
                    desireRoles.forEach((desireRole) => {
                        it(getMessage({ authRole, desireRole }), () => {
                            const result = service.isValidRoleUpdateRequest([authRole], [desireRole]);

                            expect(result).equals(expectedResult);
                        });

                    });
                });
            });
    });

    describe('Test ensure integration context', () => {
        [
            /**
             * Insufficient Calendar Permission Test
             */
            {
                description: 'should be ensured that the integration context is not handled with sign-in requests when a user is already signed up and has OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to sign-up with sign-in requests when a user is not signed up and has no OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: null,
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is handled to multiple social sign in with sign-in requests when a user is already signed up and has no OAuth integrated (hasCalendarPermission) (permission: false)',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to sign-in with sign-up requests when a user is already signed up and has OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to multiple social sign in with sign-up requests when a user is already signed up and has no OAuth integrated: Multi channel login (permission: false)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is not handled with sign-up requests when a user is not signed up and has no OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: null,
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is not handled with sign-up requests when a user is not signed up and has OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: null,
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is handled to multiple social sign in with sign-up requests when a user is signed up and has no OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is not handled with multiple social sign in requests when a user is signed up and has no OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to multiple social sign with multiple social sign in requests when a user is signed up and has no OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to sign in with multiple social sign in requests when a user is signed up and has OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to sign up with multiple social sign in requests when a user is not signed up and has no OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: null,
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is handled to sign up with integrate requests when a user is not signed up and has no OAuth integrated (permission: false)',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: null,
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is handled to integrate process when a user is already signed up and has OAuth integrated but no calendar permission (permission: false)',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            },
            {
                description: 'should be ensured that the integration context is not handled with integrate requests when a user is already signed up and has no OAuth integrated, no google integration (permission: false)',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            },
            {
                description: 'should be ensured that the integration context is not handled process when a user is already signed up, has OAuth integrated, gives the calendar permission  (permission: false)',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            },
            {
                description: 'should be ensured that the continuous integration context is handled to multiple social sign in process when user rejects to give the calendar permission with no oauth2 signed user (permission: false)',
                integrationContext: IntegrationContext.CONTINUOUS_INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.CONTINUOUS_INTEGRATE
            },
            {
                description: 'should be ensured that the continuous integration context is not handled to repeat the obtaining process of calendar permission (permission: false)',
                integrationContext: IntegrationContext.CONTINUOUS_INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.CONTINUOUS_INTEGRATE
            },

            /**
             * The Specs when calendar permission is given
             */
            {
                description: 'should be ensured that the integration context is not handled with sign-in requests when a user is already signed up and has OAuth integrated (permission true)',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to sign-up with sign-in requests when a user is not signed up and has no OAuth integrated (permission true)',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: null,
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is handled to multiple social sign in with sign-in requests when a user is already signed up and has no OAuth integrated (permission true)',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to sign-in with sign-up requests when a user is already signed up and has OAuth integrated (permission true)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to multiple social sign in with sign-up requests when a user is already signed up and has no OAuth integrated: Multi channel login (permission true)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is not handled with sign-up requests when a user is not signed up and has no OAuth integrated (permission true)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: null,
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is not handled with sign-up requests when a user is not signed up and has OAuth integrated (permission true)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: null,
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is handled to multiple social sign in with sign-up requests when a user is signed up and has no OAuth integrated (permission true)',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is not handled with multiple social sign in requests when a user is signed up and has no OAuth integrated (permission true)',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to sign in with multiple social sign in requests when a user is signed up and has OAuth integrated (permission true)',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context is handled to sign up with multiple social sign in requests when a user is not signed up and has no OAuth integrated (permission true)',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: null,
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is handled to sign up with integrate requests when a user is not signed up and has no OAuth integrated (permission true)',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: null,
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context is handled to integrate process when a user is already signed up and has OAuth integrated but no calendar permission (permission true)',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            },
            {
                description: 'should be ensured that the integration context is not handled with integrate requests when a user is already signed up and has no OAuth integrated, no google integration (permission true)',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            },
            {
                description: 'should be ensured that the integration context is not handled process when a user is already signed up, has OAuth integrated, gives the calendar permission (permission true)',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            },
            {
                description: 'should be ensured that the continuous integration context is handled to multiple social sign in process when user rejects to give the calendar permission with no oauth2 signed user (permission true)',
                integrationContext: IntegrationContext.CONTINUOUS_INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: false,
                expectedIntegrationContext: IntegrationContext.CONTINUOUS_INTEGRATE
            },
            {
                description: 'should be ensured that the integration context is not handled process when a user is already signed up, has OAuth integrated, gives the calendar permission (permission true)',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            },
            {
                description: 'should be ensured that the continuous integration context is not handled to repeat the obtaining process of calendar permission (permission true)',
                integrationContext: IntegrationContext.CONTINUOUS_INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.CONTINUOUS_INTEGRATE
            },
            {
                description: 'should be ensured that the continuous integration context is not handled to repeat the obtaining process of calendar permission (permission true)',
                integrationContext: IntegrationContext.CONTINUOUS_INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: null,
                hasCalendarPermission: true,
                expectedIntegrationContext: IntegrationContext.CONTINUOUS_INTEGRATE
            }
        ].forEach(function({
            description,
            integrationContext,
            userStub,
            oauth2AccountStub,
            hasCalendarPermission,
            expectedIntegrationContext
        }) {
            it(description, () => {

                const actualIntegrationContext = service.ensureIntegrationContext(
                    integrationContext,
                    userStub,
                    oauth2AccountStub,
                    hasCalendarPermission
                );
                expect(actualIntegrationContext).equals(expectedIntegrationContext);
            });
        });
    });

    it('should be generated for uuid', () => {
        const uuidMap = new Map<string, boolean>();

        Array(10)
            .fill(0)
            .map(() => service.generateUUID())
            .forEach((generatedUUID: string) => {
                expect(uuidMap.has(generatedUUID)).false;
                uuidMap.set(generatedUUID, false);
                expect(generatedUUID).ok;
            });
    });

    it('should be not conflicts in 5 times in 500 ms', async () => {

        const checkSet = new Set();
        let uniqueCheck = true;

        for (let i = 0; i < 5; i++) {

            await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));

            const generated = service.generateUniqueNumber();

            expect(generated).greaterThan(0);

            if (checkSet.has(generated) === false) {
                checkSet.add(generated);
            } else {
                uniqueCheck = false;
                break;
            }
        }

        expect(uniqueCheck).true;
    }).timeout(500);

    it('should be hashed for text', () => {
        const plainText = 'abcd';
        const bcryptedText = service.hash(plainText);

        expect(bcryptedText).not.eq(plainText);
    });

    it('should be generated with padding', () => {
        const digits = 4;
        Array(10)
            .fill(0)
            .map(() => service.generateRandomNumberString(digits))
            .forEach((generatedRandomNumberString) => {
                expect(generatedRandomNumberString.length).eq(4);
            });
    });

    describe('Test filtering invited new users', () => {
        it('should be filtered new users', () => {

            const invitedMemberMocks: InvitedNewTeamMember[] = [
                { email: 'alan@sync.day', phone: 'fakeuuid' },
                { email: 'fakeuuid', phone: '+821012341234' },
                { email: 'alan2@sync.day', phone: 'fakeuuid' },
                { email: 'fakeuuid', phone: '+821012341235' }
            ];
            const searchedUserMocks = stub(User, 2, {
                email: 'fakeuuid', phone: 'fakeuuid'
            });
            searchedUserMocks[0].email = invitedMemberMocks[0].email as string;
            searchedUserMocks[1].phone = invitedMemberMocks[1].phone as string;

            const filteredNewUsers = service.filterInvitedNewUsers(
                invitedMemberMocks,
                searchedUserMocks
            );

            expect(filteredNewUsers).ok;
            expect(filteredNewUsers.length).greaterThan(0);
        });
    });

    describe('Test patchDefaultEvent', () => {

        it('should be initialized a default event', () => {
            const defaultEventGroupSetting = service.getInitialEventGroupSetting();

            expect(defaultEventGroupSetting).ok;
            expect(defaultEventGroupSetting.defaultEvent.bufferTime).ok;
        });

        it('should be initialized a default event with a default link', () => {
            const defaultEventGroupSetting = service.getInitialEventGroupSetting();
            const expectedDefaultEventLink = '30-minute-meeting';

            expect(defaultEventGroupSetting.defaultEvent).ok;
            expect(defaultEventGroupSetting.defaultEvent.bufferTime).ok;
            expect(defaultEventGroupSetting.defaultEvent.link).ok;
            expect(defaultEventGroupSetting.defaultEvent.link).equals(expectedDefaultEventLink);
        });

        it('should be initialized a default event with overrided event detail', () => {

            const customEventDetail = stubOne(EventDetail, {
                notificationInfo: {}
            });

            const patchedEvent = service.patchDefaultEvent({}, {
                eventDetail: customEventDetail
            });

            expect(patchedEvent).ok;
            expect(patchedEvent.eventDetail).ok;
            expect(patchedEvent.eventDetail.description).ok;
            expect(patchedEvent.eventDetail.notificationInfo).ok;
            expect(patchedEvent.eventDetail.notificationInfo.host).not.ok;
        });

        it('should be initialized a default event with phone notification setting', () => {

            const { defaultEvent } = service.getInitialEventGroupSetting({
                hasPhoneNotification: true
            });

            expect(defaultEvent).ok;

            const { eventDetail } = defaultEvent;
            const { notificationInfo } = eventDetail;
            const { host, invitee } = notificationInfo as Required<NotificationInfo>;

            expect(host).ok;
            expect(host.length).greaterThan(1);

            expect(invitee).ok;
            expect(invitee.length).greaterThan(1);
        });

        it('should be patched a default event with a link where spaces are replaced with dashes', () => {

            const eventLinkWithSpacings = '30 minute meeting';
            const expectedEventLink = '30-minute-meeting';

            const { defaultEvent } = service.getInitialEventGroupSetting();

            const patchedEvent = service.patchDefaultEvent(defaultEvent, {
                link: eventLinkWithSpacings
            });

            expect(patchedEvent).ok;
            expect(patchedEvent.link).equals(expectedEventLink);
        });

        it('should be patched to ensure a event name to new event', () => {

            const { defaultEvent } = service.getInitialEventGroupSetting({
                hasPhoneNotification: true
            });

            const patchedEvent = service.patchDefaultEvent(defaultEvent, {});

            expect(patchedEvent).ok;
            expect(patchedEvent.name).ok;
        });
    });


    describe('Test convert', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        it('should be got patched scheduled event with source event', () => {

            const profileMock = stubOne(Profile);
            const userMock = stubOne(User);
            const userSettingMock = stubOne(UserSetting);

            const hostProfileMock = {
                profileId: profileMock.id,
                profileUUID: profileMock.uuid,
                name: profileMock.name,
                email: userMock.email,
                phone: userMock.phone,
                timezone: userSettingMock.preferredTimezone,
                language: userSettingMock.preferredLanguage,
                workspace: ''
            } as HostProfile;

            const eventDetailMock = stubOne(EventDetail, {
                notificationInfo: {}
            });
            const teamMock = stubOne(Team);
            const teamSetting = stubOne(TeamSetting);
            const eventMock = stubOne(Event, {
                name: faker.name.fullName(),
                color: faker.color.rgb(),
                contacts: [],
                eventDetail: eventDetailMock
            });
            const newScheduledEventMock = stubOne(ScheduledEvent, {
                scheduledNotificationInfo: {}
            });
            const scheduledEventNotificationStubs = stub(ScheduledEventNotification);

            serviceSandbox.stub(service, 'getPatchedScheduleNotification').returns(scheduledEventNotificationStubs);

            const patchedSchedule = service.getPatchedScheduledEvent(
                teamMock,
                hostProfileMock,
                [hostProfileMock],
                eventMock,
                newScheduledEventMock,
                teamSetting.workspace
            );

            expect(patchedSchedule).ok;
            expect(patchedSchedule.name).contains(eventMock.name);
            expect(patchedSchedule.color).equals(eventMock.color);
        });

        describe('Test scheduled event notification patch', () => {

            // TODO:
            [
                {
                    description: 'should be generaated the scheduled event notifications for host, invitee',
                    sourceNotificationInfoMock: {
                        host: [ { type: 'email', reminders: [ { 'remindBefore': '01:00:00' } ] } ],
                        invitee: [ { type: 'email', reminders: [ { 'remindBefore': '01:00:00' } ] } ]
                    } as NotificationInfo,
                    notificationInfoMock: {
                        host: [ { type: 'email', reminders: [ { 'remindBefore': '01:00:00' } ] } ],
                        invitee: [ { type: 'email', reminders: [ { 'remindBefore': '01:00:00' } ] } ]
                    } as NotificationInfo
                },
                {
                    description: 'should be generaated the scheduled event notifications for host, invitee including other hosts of event types',
                    sourceNotificationInfoMock: {
                        host: [ { type: 'email', reminders: [ { 'remindBefore': '01:00:00' } ] } ],
                        invitee: [ { type: 'email', reminders: [ { 'remindBefore': '01:00:00' } ] } ]
                    } as NotificationInfo,
                    notificationInfoMock: {
                        host: [ { type: 'email', reminders: [ { 'remindBefore': '01:00:00' } ] } ],
                        invitee: [ { type: 'email', reminders: [ { 'remindBefore': '01:00:00' } ] } ]
                    } as NotificationInfo
                }
            ].forEach(function({
                description,
                sourceNotificationInfoMock,
                notificationInfoMock
            }) {
                it(description, () => {

                    const hostProfileMock = stubOne(Profile) as unknown as HostProfile;
                    const scheduledEventMock = stubOne(ScheduledEvent, {
                        scheduledTime: {
                            startTimestamp: new Date()
                        } as ScheduledTimeset
                    });

                    const actualNewScheduledEventNotifications = service.getPatchedScheduleNotification(
                        hostProfileMock,
                        scheduledEventMock,
                        sourceNotificationInfoMock,
                        notificationInfoMock
                    );

                    expect(actualNewScheduledEventNotifications.length).ok;
                });
            });
        });
    });

    describe('Test Getting default user setting', () => {
        it('should be got default user setting which has email as workspace when there is user email', () => {
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(languageMock);

            expect(defaultUserSetting).ok;
            expect(defaultUserSetting.preferredLanguage).equals(languageMock);
        });

        it('should be got default user setting which has timezone', () => {
            const timezoneMock = 'America/New_York';
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(languageMock, {
                timezone: timezoneMock
            });

            expect(defaultUserSetting).ok;
            expect(defaultUserSetting.preferredTimezone).contains(timezoneMock);
        });

        it('should be return the file path has specified format for bucket upload with filename', () => {
            const sample = 'sample.jpg';
            const prefix = 'myprefix';

            const generated = service.generateFilePath(sample, prefix);

            expect(generated).ok;
            expect(generated).contains(prefix);
        });

        it('should be possible to convert to a date in YYYYMMDD format using toYYYYMMDD', () => {
            const expected = '2022-03-24';
            const sample = new Date(expected);

            const actual = service.toYYYYMMDD(sample);

            expect(actual).equal(expected);
        });
    });

    describe('Test Getting default team workspace', () => {

        const fullName = faker.name.fullName();
        const fakeEmailPrefix = 'foobar';
        const fakeEmail = faker.internet.email(fakeEmailPrefix);

        [
            {
                description: 'should be got default team workspace which has email as workspace when there is no email id but has name',
                workspaceMockOrDummy: fullName,
                emailMockOrDummy: undefined,
                phoneNumberMockOrDummy: fullName,
                randomSuffixMock: false,
                additionalValidations: (actualDefaultTeamWorkspace: string) => {
                    expect(actualDefaultTeamWorkspace).equals(fullName);
                }
            },
            {
                description: 'should be got default team workspace which has workspace name with generated uuid when there is no name or email',
                workspaceMockOrDummy: undefined,
                emailMockOrDummy: undefined,
                phoneNumberMockOrDummy: undefined,
                randomSuffixMock: true,
                additionalValidations: () => {}
            },
            {
                description: 'should be got default team workspace which has email as workspace with generated number when option random suffix is enabled',
                workspaceMockOrDummy: undefined,
                emailMockOrDummy: fakeEmail,
                phoneNumberMockOrDummy: undefined,
                randomSuffixMock: true,
                additionalValidations: (actualDefaultTeamWorkspace: string) => {
                    expect(actualDefaultTeamWorkspace).contains(fakeEmailPrefix);
                    expect(actualDefaultTeamWorkspace).not.equals(fakeEmailPrefix);
                    expect(actualDefaultTeamWorkspace).not.equals(fakeEmail);
                }
            },
            {
                description: 'should be got the default team workspace which has phone number as workspace with Korean phone number',
                workspaceMockOrDummy: undefined,
                emailMockOrDummy: null,
                phoneNumberMockOrDummy: '+821012345678',
                randomSuffixMock: false,
                additionalValidations: (actualDefaultTeamWorkspace: string) => {
                    const expectedLink = '01012345678';

                    expect(actualDefaultTeamWorkspace).ok;
                    expect(actualDefaultTeamWorkspace).not.null;
                    expect(actualDefaultTeamWorkspace).equals(expectedLink);
                }
            },
            {
                description: 'should be patched enforcibly random suffix when given link string length is less than 3 (two character)',
                workspaceMockOrDummy: 'ab',
                emailMockOrDummy: null,
                phoneNumberMockOrDummy: null,
                randomSuffixMock: false,
                additionalValidations: (actualDefaultTeamWorkspace: string) => {

                    const expectedWorkspaceLength = 5;

                    expect(actualDefaultTeamWorkspace).not.null;
                    expect(actualDefaultTeamWorkspace).contains('-');
                    expect(actualDefaultTeamWorkspace.length).equals(expectedWorkspaceLength);
                }
            },
            {
                description: 'should be patched enforcibly random suffix when given email id string length is less than 3 (one character)',
                workspaceMockOrDummy: undefined,
                emailMockOrDummy: 'p@sync.day',
                phoneNumberMockOrDummy: undefined,
                randomSuffixMock: false,
                additionalValidations: (actualDefaultTeamWorkspace: string) => {

                    const expectedWorkspaceLength = 4;

                    expect(actualDefaultTeamWorkspace).not.null;
                    expect(actualDefaultTeamWorkspace).contains('-');
                    expect(actualDefaultTeamWorkspace.length).equals(expectedWorkspaceLength);
                }
            }
        ].forEach(function({
            description,
            workspaceMockOrDummy,
            emailMockOrDummy,
            phoneNumberMockOrDummy,
            randomSuffixMock,
            additionalValidations
        }) {

            it(description, () => {

                const defaultTeamWorkspace = service.getDefaultTeamWorkspace(
                    workspaceMockOrDummy,
                    emailMockOrDummy,
                    phoneNumberMockOrDummy,
                    {
                        randomSuffix: randomSuffixMock
                    }
                );

                expect(defaultTeamWorkspace).ok;

                additionalValidations(defaultTeamWorkspace);
            });
        });
    });

    describe('Test getDefaultAvailabilityName', () => {
        Object.values(Language).forEach(function(language: Language) {
            it(`should be retrieved a default availability name for ${language}`, () => {
                const defaultName = service.getDefaultAvailabilityName(language);

                expect(defaultName).ok;
            });
        });
    });

    describe('Test convertScheduleNotificationToNotificationDataAndPublishKey', () => {
        [
            {
                description: 'If the notificationTarget is "host" and the notificationType is "email", then the temaplate must be "email cancelled" and the notification publish key must be "email"',
                scheduleNotificationMock: stubOne(ScheduledEventNotification, {
                    notificationTarget: NotificationTarget.HOST,
                    notificationType: NotificationType.EMAIL
                }),
                expectedTemplate: EmailTemplate.CANCELLED,
                expectedSyncdayNotificationPublishKey: SyncdayNotificationPublishKey.EMAIL
            },
            {
                description: 'If the notificationTarget is "invitee" and the notificationType is "email", then the temaplate must be "email cancelled" and the notification publish key must be "email"',
                scheduleNotificationMock: stubOne(ScheduledEventNotification, {
                    notificationTarget: NotificationTarget.INVITEE,
                    notificationType: NotificationType.EMAIL
                }),
                expectedTemplate: EmailTemplate.CANCELLED,
                expectedSyncdayNotificationPublishKey: SyncdayNotificationPublishKey.EMAIL
            },
            {
                description: 'If the notificationTarget is "host" and the notificationType is "text" and reminderType is "kakaotalk", then the temaplate must be "text cancelled host" and the notification publish key must be "kakaotalk"',
                scheduleNotificationMock: stubOne(ScheduledEventNotification, {
                    notificationTarget: NotificationTarget.HOST,
                    notificationType: NotificationType.TEXT,
                    reminderType: ReminderType.KAKAOTALK
                }),
                expectedTemplate: TextTemplate.EVENT_CANCELLED_HOST,
                expectedSyncdayNotificationPublishKey: SyncdayNotificationPublishKey.KAKAOTALK
            },
            {
                description: 'If the notificationTarget is "invitee" and the notificationType is "text" and reminderType is "kakaotalk", then the temaplate must be "text cancelled invitee" and the notification publish key must be "kakaotalk"',
                scheduleNotificationMock: stubOne(ScheduledEventNotification, {
                    notificationTarget: NotificationTarget.INVITEE,
                    notificationType: NotificationType.TEXT,
                    reminderType: ReminderType.KAKAOTALK
                }),
                expectedTemplate: TextTemplate.EVENT_CANCELLED_INVITEE,
                expectedSyncdayNotificationPublishKey: SyncdayNotificationPublishKey.KAKAOTALK
            },
            {
                description: 'If the notificationTarget is "host" and the notificationType is "text" and reminderType is "sms", then the temaplate must be "text cancelled host" and the notification publish key must be "sms-global"',
                scheduleNotificationMock: stubOne(ScheduledEventNotification, {
                    notificationTarget: NotificationTarget.HOST,
                    notificationType: NotificationType.TEXT,
                    reminderType: ReminderType.SMS
                }),
                expectedTemplate: TextTemplate.EVENT_CANCELLED_HOST,
                expectedSyncdayNotificationPublishKey: SyncdayNotificationPublishKey.SMS_GLOBAL
            },
            {
                description: 'If the notificationTarget is "invitee" and the notificationType is "text" and reminderType is "sms", then the temaplate must be "text cancelled invitee" and the notification publish key must be "sms-global"',
                scheduleNotificationMock: stubOne(ScheduledEventNotification, {
                    notificationTarget: NotificationTarget.INVITEE,
                    notificationType: NotificationType.TEXT,
                    reminderType: ReminderType.SMS
                }),
                expectedTemplate: TextTemplate.EVENT_CANCELLED_INVITEE,
                expectedSyncdayNotificationPublishKey: SyncdayNotificationPublishKey.SMS_GLOBAL
            },
            {
                description: 'If the notificationTarget is "host" and the notificationType is "text" and reminderType is "whatsapp", then the temaplate must be "text cancelled host" and the notification publish key must be "whatsapp"',
                scheduleNotificationMock: stubOne(ScheduledEventNotification, {
                    notificationTarget: NotificationTarget.HOST,
                    notificationType: NotificationType.TEXT,
                    reminderType: ReminderType.WAHTSAPP
                }),
                expectedTemplate: TextTemplate.EVENT_CANCELLED_HOST,
                expectedSyncdayNotificationPublishKey: SyncdayNotificationPublishKey.WHATSAPP
            },
            {
                description: 'If the notificationTarget is "invitee" and the notificationType is "text" and reminderType is "whatsapp", then the temaplate must be "text cancelled invitee" and the notification publish key must be "whatsapp"',
                scheduleNotificationMock: stubOne(ScheduledEventNotification, {
                    notificationTarget: NotificationTarget.INVITEE,
                    notificationType: NotificationType.TEXT,
                    reminderType: ReminderType.WAHTSAPP
                }),
                expectedTemplate: TextTemplate.EVENT_CANCELLED_INVITEE,
                expectedSyncdayNotificationPublishKey: SyncdayNotificationPublishKey.WHATSAPP
            }
        ].forEach( function ({
            description,
            scheduleNotificationMock,
            expectedTemplate,
            expectedSyncdayNotificationPublishKey
        }) {
            it(description, () => {
                const convertResult = service.convertScheduleNotificationToNotificationDataAndPublishKey(scheduleNotificationMock);

                expect(convertResult.notificationData.template).equals(expectedTemplate);
                expect(convertResult.syncdayNotificationPublishKey).equals(expectedSyncdayNotificationPublishKey);
            });
        });
    });
});
