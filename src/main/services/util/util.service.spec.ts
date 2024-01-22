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
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledEventNotification } from '@entity/scheduled-events/scheduled-event-notification.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { NotificationTarget } from '@entity/scheduled-events/notification-target.enum';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { Language } from '../../enums/language.enum';
import { faker } from '@faker-js/faker';
import { TestMockUtil } from '@test/test-mock-util';
import { UtilService } from './util.service';

interface RoleUpdateTestParameters {
    authRole: Role;
    desireRole: Role;
}

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

    describe('Search Option Patching Test', () => {

        (
            [
                {
                    description: 'should be ensured that the team ID option is patched in the absence of query parameters, provided the user possesses member permissions',
                    searchOptionMock: { teamId: undefined, id: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, id: 2, userId: 3 }
                },
                {

                    description: 'should be ensured that the team ID option is patched in the absence of query parameters, provided the user possesses manager permissions',
                    searchOptionMock: { teamId: undefined, id: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MANAGER] },
                    expected: { teamId: 1, id: undefined, userId: undefined }
                },
                {
                    description: 'should be ensured that the team ID option is patched in the absence of query parameters, provided the user possesses owner permissions',
                    searchOptionMock: { teamId: undefined, id: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.OWNER] },
                    expected: { teamId: 1, id: undefined, userId: undefined }
                },
                {
                    description: 'should be ensured that the team id search option is patched when the team id is queried',
                    searchOptionMock: { teamId: 1, id: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, id: undefined, userId: undefined }
                },
                {
                    description: 'should be ensured that the team id search option is patched when the team id is queried with wrong value fixing automatically',
                    searchOptionMock: { teamId: 4, id: undefined, userId: undefined },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, id: undefined, userId: undefined }
                },
                {
                    description: 'should be ensured that the user id search option is patched when user id is queried with wrong value fixing automatically',
                    searchOptionMock: { teamId: undefined, id: undefined, userId: 3 },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, id: 2, userId: 3 }
                },
                {
                    description: 'should be ensured that the profile id search option is patched when profile id is queried with wrong value fixing automatically',
                    searchOptionMock: { teamId: 6, id: 7, userId: 8 },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MEMBER] },
                    expected: { teamId: 1, id: 2, userId: 3 }
                },
                {
                    description: 'should be ensured that user and profile id search option as query params are patched when profile id is queried and user has a permission',
                    searchOptionMock: { teamId: 6, id: 7, userId: 8 },
                    authProfileMock: { teamId: 1, id: 2, userId: 3, roles: [Role.MANAGER] },
                    expected: { teamId: 1, id: 7, userId: 8 }
                }
            ] as Array<{
                description: string;
                searchOptionMock: Partial<Pick<AppJwtPayload, 'teamId' | 'id' | 'userId'>>;
                authProfileMock: AppJwtPayload;
                expected: Partial<Pick<AppJwtPayload, 'teamId' | 'id' | 'userId'>>;
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
                    userId: expectedUserId
                } = expected;

                expect(parsedSearchOption.teamId).equals(expectedTeamId);
                expect(parsedSearchOption.id).equals(expectedProfileId);
                expect(parsedSearchOption.userId).equals(expectedUserId);
            });
        });
    });

    describe('Proration Test', () => {
        it('It should be calculated that the proration for an amount of 26,970, which divides evenly by 29 for February and by 30 or 31, results in whole numbers of 930, 899, or 870', () => {
            const amountMock = 26970;

            const _15daysAfterPaymentPeriodMock = new Date();
            _15daysAfterPaymentPeriodMock.setDate(_15daysAfterPaymentPeriodMock.getDate() + 15);

            const previousPeriod = new Date(_15daysAfterPaymentPeriodMock);
            previousPeriod.setMonth(previousPeriod.getMonth() - 1);

            const actual = service.getProratedPrice(amountMock, _15daysAfterPaymentPeriodMock);

            // 29 for Feb or 30 or 31 days
            const day = 1000 * 60 * 60 * 24;
            const diffDays = (_15daysAfterPaymentPeriodMock.getTime() - previousPeriod.getTime()) / day;

            expect(actual).ok;
            expect(actual).equals(amountMock / diffDays * 14);
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
            {
                description: 'should be ensured that the integration context combines sign-in with sign-in requests when a user is already signed up and has OAuth integrated',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign-up with sign-in requests when a user is not signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: null,
                oauth2AccountStub: null,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign in with sign-in requests when a user is already signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: null,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign-in with sign-up requests when a user is already signed up and has OAuth integrated',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign in with sign-up requests when a user is already signed up and has no OAuth integrated: Multi channel login',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: null,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign-up with sign-up requests when a user is not signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: null,
                oauth2AccountStub: null,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines sign-up with sign-up requests when a user is not signed up and has OAuth integrated',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: null,
                oauth2AccountStub: new OAuth2Account(),
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign in with sign-up requests when a user is signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: null,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign with multiple social sign in requests when a user is signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: null,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign with multiple social sign in requests when a user is signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign in with multiple social sign in requests when a user is signed up and has OAuth integrated',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign up with multiple social sign in requests when a user is not signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: null,
                oauth2AccountStub: null,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines sign up with integrate requests when a user is not signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: null,
                oauth2AccountStub: null,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines sign in process with integrate requests when a user is already signed up and has OAuth integrated',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            },
            {
                description: 'should be ensured that the integration context combines integrate process with integrate requests when a user is already signed up and has no OAuth integrated, no google integration',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: null,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            }
        ].forEach(function({
            description,
            integrationContext,
            userStub,
            oauth2AccountStub,
            expectedIntegrationContext
        }) {
            it(description, () => {

                const actualIntegrationContext = service.ensureIntegrationContext(
                    integrationContext,
                    userStub,
                    oauth2AccountStub
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

    describe('Test getDefaultEvent', () => {

        it('should be generated a default event', () => {
            const defaultEvent = service.getDefaultEvent();

            expect(defaultEvent).ok;
            expect(defaultEvent.bufferTime).ok;
        });

        it('should be generated a default event with a default link', () => {
            const defaultEvent = service.getDefaultEvent();
            const expectedDefaultEventLink = '30-minute-meeting';

            expect(defaultEvent).ok;
            expect(defaultEvent.bufferTime).ok;
            expect(defaultEvent.link).ok;
            expect(defaultEvent.link).equals(expectedDefaultEventLink);
        });

        it('should be generated a default event with a link where changed lowercase from uppercased link', () => {

            const uppercaseEventLink = '30-Minute-Meeting';
            const expectedEventLink = '30-minute-meeting';

            const defaultEvent = service.getDefaultEvent({
                link: uppercaseEventLink
            });

            expect(defaultEvent).ok;
            expect(defaultEvent.link).equals(expectedEventLink);
        });

        it('should be generated a default event with a link where spaces are replaced with dashes', () => {

            const eventLinkWithSpacings = '30 minute meeting';
            const expectedEventLink = '30-minute-meeting';

            const defaultEvent = service.getDefaultEvent({
                link: eventLinkWithSpacings
            });

            expect(defaultEvent).ok;
            expect(defaultEvent.link).equals(expectedEventLink);
        });

        it('should be generated a default event with overrided event detail', () => {

            const customEventDetail = stubOne(EventDetail, {
                notificationInfo: {}
            });

            const defaultEvent = service.getDefaultEvent({
                eventDetail: customEventDetail
            });

            expect(defaultEvent).ok;
            expect(defaultEvent.eventDetail).ok;
            expect(defaultEvent.eventDetail.description).ok;
            expect(defaultEvent.eventDetail.notificationInfo).ok;
            expect(defaultEvent.eventDetail.notificationInfo.host).not.ok;
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
            const userSettingStub = stubOne(UserSetting);
            const userMock = stubOne(User, {
                userSetting: userSettingStub
            });
            const profileMock = stubOne(Profile);
            const eventDetailMock = stubOne(EventDetail);
            const teamSetting = stubOne(TeamSetting);
            const availability = stubOne(Availability);
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
                userMock,
                profileMock,
                eventMock,
                newScheduledEventMock,
                teamSetting.workspace,
                availability.timezone
            );

            expect(patchedSchedule).ok;
            expect(patchedSchedule.name).contains(eventMock.name);
            expect(patchedSchedule.color).equals(eventMock.color);
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

        it('should be got default team workspace which has email as workspace when there is no email id but has name', () => {

            const fullNameMock = faker.name.fullName();

            const workspaceMock = fullNameMock;
            const emailMock = undefined;
            const profileNameMock = fullNameMock;

            const defaultTeamWorkspace = service.getDefaultTeamWorkspace(
                workspaceMock,
                emailMock,
                profileNameMock,
                {
                    randomSuffix: false,
                    uuidWorkspace: false
                }
            );

            expect(defaultTeamWorkspace).ok;
            expect(defaultTeamWorkspace).equals(profileNameMock);
        });

        it('should be got default team workspace which has workspace name with generated uuid when there is no name or email', () => {

            const workspaceMock = undefined;
            const emailMock = undefined;
            const profileNameMock = undefined;

            const defaultTeamWorkspace = service.getDefaultTeamWorkspace(
                workspaceMock,
                emailMock,
                profileNameMock,
                {
                    randomSuffix: true,
                    uuidWorkspace: false
                }
            );

            expect(defaultTeamWorkspace).ok;
        });

        it('should be got default team workspace which has email as workspace with generated number when option random suffix is enabled', () => {
            const workspaceMock = undefined;

            const emailPrefix = 'foobar';
            const emailMock = faker.internet.email(emailPrefix);

            const profileNameMock = undefined;

            const defaultTeamWorkspace = service.getDefaultTeamWorkspace(
                workspaceMock,
                emailMock,
                profileNameMock,
                {
                    randomSuffix: true,
                    uuidWorkspace: false
                }
            );

            expect(defaultTeamWorkspace).ok;
            expect(defaultTeamWorkspace).contains(emailPrefix);
            expect(defaultTeamWorkspace).not.equals(emailPrefix);
            expect(defaultTeamWorkspace).not.equals(emailMock);
        });

        it('should be got the default team workspace which has phone number as workspace with Korean phone number', () => {
            const workspaceMock = undefined;

            const emailDummy = null;

            const profileNameMock = 'alan123';

            const defaultTeamWorkspace = service.getDefaultTeamWorkspace(
                workspaceMock,
                emailDummy,
                profileNameMock,
                {
                    randomSuffix: false,
                    uuidWorkspace: false
                }
            );

            expect(defaultTeamWorkspace).ok;
            expect(defaultTeamWorkspace).not.equals(emailDummy);
            expect(defaultTeamWorkspace).contains(profileNameMock);
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
