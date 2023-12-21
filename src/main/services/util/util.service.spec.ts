import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { TextTemplate } from '@core/interfaces/notifications/text-template.enum';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { ReminderType } from '@interfaces/reminders/reminder-type.enum';
import { InvitedNewTeamMember } from '@services/team/invited-new-team-member.type';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledEventNotification } from '@entity/schedules/scheduled-event-notification.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { NotificationTarget } from '@entity/schedules/notification-target.enum';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { Language } from '../../enums/language.enum';
import { faker } from '@faker-js/faker';
import { UtilService } from './util.service';

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
                { email: 'alan@sync.day' },
                { phone: '+821012341234' },
                { email: 'alan2@sync.day' },
                { phone: '+821012341235' }
            ];
            const searchedUserMocks = stub(User, 2);
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
    });


    describe('Test convert', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        it('should be got patched schedule with source event', () => {
            const userMock = stubOne(User);
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
            const newScheduleMock = stubOne(Schedule, {
                scheduledNotificationInfo: {}
            });
            const scheduledEventNotificationStubs = stub(ScheduledEventNotification);

            serviceSandbox.stub(service, 'getPatchedScheduleNotification').returns(scheduledEventNotificationStubs);

            const patchedSchedule = service.getPatchedScheduledEvent(
                userMock,
                profileMock,
                eventMock,
                newScheduleMock,
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
                    randomSuffix: false
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
                    randomSuffix: true
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
                    randomSuffix: true
                }
            );

            expect(defaultTeamWorkspace).ok;
            expect(defaultTeamWorkspace).contains(emailPrefix);
            expect(defaultTeamWorkspace).not.equals(emailPrefix);
            expect(defaultTeamWorkspace).not.equals(emailMock);
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
