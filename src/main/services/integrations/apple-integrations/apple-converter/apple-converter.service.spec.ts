import { Test, TestingModule } from '@nestjs/testing';
import * as icalModule from 'ical';
import { UserSetting } from '@entity/users/user-setting.entity';
import { User } from '@entity/users/user.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { AppleConverterService } from './apple-converter.service';

const testMockUtil = new TestMockUtil();

describe('AppleConverterService', () => {
    let service: AppleConverterService;

    let icalModuleParseICSStub: sinon.SinonStub;

    before(async () => {

        icalModuleParseICSStub = sinon.stub(icalModule, 'parseICS');

        const module: TestingModule = await Test.createTestingModule({
            providers: [AppleConverterService]
        }).compile();

        service = module.get<AppleConverterService>(AppleConverterService);
    });

    after(() => {
        icalModuleParseICSStub.reset();
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test converting', () => {
        it('should be converted to apple calendar integration from cal dav calendar', () => {
            const webDAVCalendarStub = testMockUtil.getCalDAVCalendarMock();

            const userTimezone = 'Asia/Seoul';

            const convertedAppleCalendarIntegration = service.convertCalDAVCalendarToAppleCalendarIntegration(userTimezone, webDAVCalendarStub);

            expect(convertedAppleCalendarIntegration).ok;
            expect(convertedAppleCalendarIntegration.name).ok;
            expect(convertedAppleCalendarIntegration.timezone).ok;
            expect(convertedAppleCalendarIntegration.color).ok;
        });

        it('should be converted to apple calendar integration schedules from cal dav calendar objects', () => {

            const userStub = stubOne(User);
            const userSettingStub = stubOne(UserSetting);
            const calDAVCalendarObjectMock = testMockUtil.getCalDAVCalendarObjectMock();

            icalModuleParseICSStub.returns(calDAVCalendarObjectMock);

            const convertedAppleCalendarIntegrationSchedules = service.convertCalDAVCalendarObjectsToAppleCalDAVIntegrationSchedules(
                userStub.uuid,
                userSettingStub.workspace,
                userSettingStub.preferredTimezone,
                calDAVCalendarObjectMock
            );

            expect(convertedAppleCalendarIntegrationSchedules).ok;
            expect(convertedAppleCalendarIntegrationSchedules.length).greaterThan(0);

            const convertedAppleCalendarIntegrationSchedule = convertedAppleCalendarIntegrationSchedules[0];
            expect(convertedAppleCalendarIntegrationSchedule).ok;
            expect(convertedAppleCalendarIntegrationSchedule.name).ok;
            expect(convertedAppleCalendarIntegrationSchedule.scheduledTime).ok;
            expect(convertedAppleCalendarIntegrationSchedule.scheduledTime.startTimestamp).ok;
            expect(convertedAppleCalendarIntegrationSchedule.scheduledTime.endTimestamp).ok;
            expect(convertedAppleCalendarIntegrationSchedule.iCalUID).ok;
        });
    });
});
