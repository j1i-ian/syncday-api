import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledEventNotification } from '@entity/schedules/scheduled-event-notification.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
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
                integrationStub: new OAuth2Account(),
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign-up with sign-in requests when a user is not signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: null,
                oauth2AccountStub: null,
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign in with sign-in requests when a user is already signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: null,
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign-in with sign-up requests when a user is already signed up and has OAuth integrated',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                integrationStub: new OAuth2Account(),
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign in with sign-up requests when a user is already signed up and has no OAuth integrated: Multi channel login',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: null,
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign-up with sign-up requests when a user is not signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: null,
                oauth2AccountStub: null,
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines sign-up with sign-up requests when a user is not signed up and has OAuth integrated',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: null,
                oauth2AccountStub: new OAuth2Account(),
                integrationStub: new OAuth2Account(),
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign in with sign-up requests when a user is signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.SIGN_UP,
                userStub: new User(),
                oauth2AccountStub: null,
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign with multiple social sign in requests when a user is signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: null,
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign with multiple social sign in requests when a user is signed up and has no OAuth integrated but has a google integration',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: null,
                integrationStub: new GoogleIntegration(),
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines multiple social sign with multiple social sign in requests when a user is signed up and has no OAuth integrated, no google integration',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign in with multiple social sign in requests when a user is signed up and has OAuth integrated and google integration',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                integrationStub: new GoogleIntegration(),
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign up with multiple social sign in requests when a user is not signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                userStub: null,
                oauth2AccountStub: null,
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines sign up with integrate requests when a user is not signed up and has no OAuth integrated',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: null,
                oauth2AccountStub: null,
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.SIGN_UP
            },
            {
                description: 'should be ensured that the integration context combines sign in process with integrate requests when a user is already signed up and has OAuth integrated, google integration',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                integrationStub: new GoogleIntegration(),
                expectedIntegrationContext: IntegrationContext.SIGN_IN
            },
            {
                description: 'should be ensured that the integration context combines sign in process with integrate requests when a user is already signed up and has OAuth integrated, no google integration',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: new OAuth2Account(),
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            },
            {
                description: 'should be ensured that the integration context combines integrate process with integrate requests when a user is already signed up and has no OAuth integrated, no google integration',
                integrationContext: IntegrationContext.INTEGRATE,
                userStub: new User(),
                oauth2AccountStub: null,
                integrationStub: null,
                expectedIntegrationContext: IntegrationContext.INTEGRATE
            }
        ].forEach(function({
            description,
            integrationContext,
            userStub,
            oauth2AccountStub,
            integrationStub,
            expectedIntegrationContext
        }) {
            it(description, () => {

                const actualIntegrationContext = service.ensureIntegrationContext(
                    integrationContext,
                    userStub,
                    oauth2AccountStub,
                    integrationStub
                );
                expect(actualIntegrationContext).equals(expectedIntegrationContext);
            });
        });
    });


    it('should be converted date that is applied timezone', () => {

        const hostTimezone = 'America/New_York';
        const hostAvailableStartTimeString = '10:00';

        const availableStartTime = new Date('2023-07-13 10:00:00 GMT-04:00');

        // 2023-07-13 03:00:00 GMT-04:00
        const scheduledEventStartTimeByInvitee = new Date('2023-07-13 16:00:00 GMT+09:00');

        const localizedStartTime = service.localizeDateTime(
            availableStartTime,
            hostTimezone,
            hostAvailableStartTimeString
        );

        const isValidStartTime = localizedStartTime.getTime() < scheduledEventStartTimeByInvitee.getTime();

        expect(isValidStartTime).false;
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
            const eventDetailMock = stubOne(EventDetail);
            const userSetting = stubOne(UserSetting);
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
                eventMock,
                newScheduleMock,
                userSetting.workspace,
                availability.timezone
            );

            expect(patchedSchedule).ok;
            expect(patchedSchedule.name).contains(eventMock.name);
            expect(patchedSchedule.color).equals(eventMock.color);
        });
    });

    describe('Test Getting default user setting', () => {
        it('should be got default user setting which has email as workspace when there is user email', () => {
            const emailPrefix = 'foobar';
            const userMock = stubOne(User, {
                email: faker.internet.email(emailPrefix)
            });
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(userMock, languageMock);

            expect(defaultUserSetting).ok;
            expect(defaultUserSetting.workspace).contains(emailPrefix);
            expect(defaultUserSetting.preferredLanguage).equals(languageMock);
        });

        it('should be got default user setting which has email as workspace when there is no email id but has name', () => {
            const nameStub = faker.name.fullName();

            const userMock = stubOne(User, {
                name: nameStub,
                email: undefined
            });
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(userMock, languageMock, {
                randomSuffix: false
            });

            expect(defaultUserSetting).ok;
            expect(defaultUserSetting.workspace).equals(nameStub);
            expect(defaultUserSetting.preferredLanguage).equals(languageMock);
        });

        it('should be got default user setting which has workspace name with generated uuid when there is no name or email', () => {
            const userMock = stubOne(User, {
                email: undefined,
                name: undefined
            });
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(userMock, languageMock, {
                randomSuffix: true
            });

            expect(defaultUserSetting).ok;
            expect(defaultUserSetting.workspace).ok;
            expect(defaultUserSetting.preferredLanguage).equals(languageMock);
        });

        it('should be got default user setting which has email as workspace with generated number when option random suffix is enabled', () => {
            const emailPrefix = 'foobar';
            const userMock = stubOne(User, {
                email: faker.internet.email(emailPrefix)
            });
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(userMock, languageMock, {
                randomSuffix: true
            });

            expect(defaultUserSetting).ok;
            expect(defaultUserSetting.workspace).contains(emailPrefix);
            expect(defaultUserSetting.workspace).not.equals(emailPrefix);
            expect(defaultUserSetting.workspace).not.equals(userMock.email);
            expect(defaultUserSetting.preferredLanguage).equals(languageMock);
        });

        it('should be got default user setting which has timezone', () => {
            const userMock = stubOne(User, {
                name: faker.name.fullName()
            });
            const timezoneMock = 'America/New_York';
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(userMock, languageMock, {
                randomSuffix: true,
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

    describe('Test getDefaultAvailabilityName', () => {
        Object.values(Language).forEach(function(language: Language) {
            it(`should be retrieved a default availability name for ${language}`, () => {
                const defaultName = service.getDefaultAvailabilityName(language);

                expect(defaultName).ok;
            });
        });
    });
});
