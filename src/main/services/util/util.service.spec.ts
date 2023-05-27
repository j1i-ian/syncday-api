import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { User } from '@entity/users/user.entity';
import { EmailTemplate } from '../../enums/email-template.enum';
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

    it('should be got asset full path', () => {
        const fullPath = service.getMailAssetFullPath(EmailTemplate.VERIFICATION, Language.ENGLISH);

        expect(fullPath).ok;
        expect(fullPath).contains('hbs');
    });

    describe('Test Getting default user setting', () => {
        it('should be got default user setting which has workspace name when there is user name', () => {
            const userMock = stubOne(User, {
                name: faker.name.fullName()
            });
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(userMock, languageMock);

            expect(defaultUserSetting).ok;
            expect(defaultUserSetting.workspace).contains(userMock.name);
            expect(defaultUserSetting.preferredLanguage).equals(languageMock);
        });

        it('should be got default user setting which has workspace name when there is no user name but email prefix', () => {
            const emailPrefix = 'foobar';

            const userMock = stubOne(User, {
                name: undefined,
                email: faker.internet.email(emailPrefix)
            });
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(userMock, languageMock, {
                randomSuffix: false
            });

            expect(defaultUserSetting).ok;
            expect(defaultUserSetting.workspace).contains(emailPrefix);
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
            expect(defaultUserSetting.workspace).not.contain(userMock.name);
            expect(defaultUserSetting.workspace).not.contain(userMock.email);
            expect(defaultUserSetting.preferredLanguage).equals(languageMock);
        });

        it('should be got default user setting which has workspace name with generated number when option random suffix is enabled', () => {
            const userMock = stubOne(User, {
                name: faker.name.fullName()
            });
            const languageMock = Language.ENGLISH;

            const defaultUserSetting = service.getUserDefaultSetting(userMock, languageMock, {
                randomSuffix: true
            });

            expect(defaultUserSetting).ok;
            expect(defaultUserSetting.workspace).contains(userMock.name);
            expect(defaultUserSetting.workspace).not.equals(userMock.name);
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
    });
});