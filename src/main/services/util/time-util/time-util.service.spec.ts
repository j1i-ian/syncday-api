import { Test, TestingModule } from '@nestjs/testing';
import * as icsModule from 'ics';
import { BadRequestException } from '@nestjs/common';
import { QuestionInputType } from '@interfaces/events/invitee/question-input-type';
import { Schedule } from '@entity/schedules/schedule.entity';
import { Host } from '@entity/schedules/host.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { TimeUtilService } from './time-util.service';

describe('TimeUtilService', () => {
    let service: TimeUtilService;

    let icsModuleCreateEventStub: sinon.SinonStub;

    before(async () => {

        icsModuleCreateEventStub = sinon.stub(icsModule, 'createEvent');

        const module: TestingModule = await Test.createTestingModule({
            providers: [TimeUtilService]
        }).compile();

        service = module.get<TimeUtilService>(TimeUtilService);
    });

    after(() => {
        icsModuleCreateEventStub.restore();
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be converted to ics string', () => {
        const uuidMock = 'AABBCCDDEEFF';
        const organizerEmailMock = TestMockUtil.faker.internet.email();
        const scheduleMock = stubOne(Schedule, {
            scheduledTime: {
                startTimestamp: new Date(),
                endTimestamp: new Date()
            },
            host: {
                name: 'hostName'
            } as Host,
            inviteeAnswers: [
                {
                    name: 'sampleInviteeName',
                    inputType: QuestionInputType.TEXT,
                    required: true
                }
            ],
            scheduledEventNotifications: []
        });

        const icsStringStub = 'sampleICSString';

        icsModuleCreateEventStub.returns({
            error: null,
            value: icsStringStub
        });

        const convertedICSString = service.convertToICSString(
            uuidMock,
            organizerEmailMock,
            scheduleMock
        );

        expect(convertedICSString).ok;
    });

    it('should be converted to ics string without METHOD: string for RFC ', () => {
        const uuidMock = 'AABBCCDDEEFF';
        const organizerEmailMock = TestMockUtil.faker.internet.email();
        const scheduleMock = stubOne(Schedule, {
            scheduledTime: {
                startTimestamp: new Date(),
                endTimestamp: new Date()
            },
            host: {
                name: 'hostName'
            } as Host,
            inviteeAnswers: [
                {
                    name: 'sampleInviteeName',
                    inputType: QuestionInputType.TEXT,
                    required: true
                }
            ],
            scheduledEventNotifications: []
        });

        const icsStringStub = 'sampleICSString.. METHOD:POST\r\n\r\n';
        const expectedICSString = 'sampleICSString.. \r\n';

        icsModuleCreateEventStub.returns({
            error: null,
            value: icsStringStub
        });

        const actualConvertedICSString = service.convertToICSString(
            uuidMock,
            organizerEmailMock,
            scheduleMock
        );

        expect(actualConvertedICSString).ok;
        expect(actualConvertedICSString).equals(expectedICSString);
    });

    it('should be threw an error for ics converting error', () => {
        const uuidMock = 'AABBCCDDEEFF';
        const organizerEmailMock = TestMockUtil.faker.internet.email();
        const scheduleMock = stubOne(Schedule, {
            scheduledTime: {
                startTimestamp: new Date(),
                endTimestamp: new Date()
            },
            host: {
                name: 'hostName'
            } as Host,
            inviteeAnswers: [
                {
                    name: 'sampleInviteeName',
                    inputType: QuestionInputType.TEXT,
                    required: true
                }
            ],
            scheduledEventNotifications: []
        });

        icsModuleCreateEventStub.returns({
            error: new Error(),
            value: null
        });

        expect(() => service.convertToICSString(
            uuidMock,
            organizerEmailMock,
            scheduleMock
        )).throws(BadRequestException);
    });

    it('should be got a timezone gmt string', () => {
        const timezone = 'Asia/Seoul';
        const expectedGMTString = 'GMT+09:00';

        const actualGMTString = service.getTimezoneGMTString(timezone);

        expect(actualGMTString).equals(expectedGMTString);
    });
});
