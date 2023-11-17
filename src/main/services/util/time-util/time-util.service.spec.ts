import { Test, TestingModule } from '@nestjs/testing';
import * as icsModule from 'ics';
import { BadRequestException } from '@nestjs/common';
import { QuestionInputType } from '@interfaces/events/invitee/question-input-type';
import { Weekday } from '@interfaces/availability/weekday.enum';
import { AvailableTime } from '@interfaces/availability/available-time';
import { Schedule } from '@entity/schedules/schedule.entity';
import { Host } from '@entity/schedules/host.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { TimeUtilService } from './time-util.service';

const testMockUtil = new TestMockUtil();

describe('TimeUtilService', () => {
    let service: TimeUtilService;

    let icsModuleCreateEventStub: sinon.SinonStub;

    const _1Hour = 60 * 60 * 1000;

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

    [
        {
            description: 'should be equal to the New York localized date with the input date in New York Time',
            hostTimezone: 'America/New_York',
            hostAvailableStartTimeString: '10:00',
            availableStartTime: new Date('2023-07-13 10:00:00 GMT-04:00'),
            expectedLocalizedStartTime: new Date('2023-07-13 10:00:00 GMT-04:00'),
            inviteeRequestTime: new Date('2023-07-13 13:00:00 GMT-04:00'),
            overrideOptions: null
        },
        {
            description: 'should be equal to the New York localized date with the input date in New York Time for date override calculation',
            hostTimezone: 'America/New_York',
            hostAvailableStartTimeString: '10:00',
            availableStartTime: new Date('2023-07-13T00:00:00'),
            expectedLocalizedStartTime: new Date('2023-07-13 10:00:00 GMT-04:00'),
            inviteeRequestTime: new Date('2023-07-13 13:00:00 GMT-04:00'),
            overrideOptions: {
                day: 13
            }
        },
        {
            description: 'should be equal to the New York localized date with the input date in New York Time for date override calculation',
            hostTimezone: 'Asia/Seoul',
            hostAvailableStartTimeString: '13:00',
            availableStartTime: new Date('2023-07-13T00:00:00'),
            expectedLocalizedStartTime: new Date('2023-07-13 13:00:00 GMT+09:00'),
            inviteeRequestTime: new Date('2023-07-13 18:00:00 GMT-04:00'),
            overrideOptions: {
                day: 13
            }
        }
    ].forEach(function({
        description,
        hostTimezone,
        hostAvailableStartTimeString,
        availableStartTime,
        expectedLocalizedStartTime,
        inviteeRequestTime,
        overrideOptions
    }) {

        it(description, () => {

            const localizedDateTime = service.localizeDateTime(
                availableStartTime,
                hostTimezone,
                hostAvailableStartTimeString,
                overrideOptions
            );

            const localizedDateTimestamp = localizedDateTime.getTime();
            expect(localizedDateTimestamp).equals(expectedLocalizedStartTime.getTime());

            const isInviteeRequestTimeInOverrideRange = localizedDateTime.getTime() < inviteeRequestTime.getTime();
            expect(isInviteeRequestTimeInOverrideRange).true;
        });
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

    describe('Test for ensured schedule start time and end time compare with now test', () => {
        [
            {
                description: 'should be returned true if the ensured schedule start time is earlier than now',
                startDateTimestampMock: Date.now() - _1Hour,
                ensuredEndDateTimestampMock: Date.now() + _1Hour,
                expectedResult: true
            },
            {
                description: 'should be returned true if the ensured schedule end time is earlier than now',
                startDateTimestampMock: Date.now() + _1Hour,
                ensuredEndDateTimestampMock: Date.now() - _1Hour,
                expectedResult: true
            },
            {
                description: 'should be returned false if both the ensured schedule start time and end time are later than now',
                startDateTimestampMock: Date.now() + _1Hour,
                ensuredEndDateTimestampMock: Date.now() + 2 * _1Hour,
                expectedResult: false
            }
        ].forEach(function ({
            description,
            startDateTimestampMock,
            ensuredEndDateTimestampMock,
            expectedResult
        }) {
            it(description, () => {
                const result = service.isPastTimestamp(startDateTimestampMock, ensuredEndDateTimestampMock);

                expect(result).equal(expectedResult);

            });
        });
    });

    describe('Test for verifying the overlap between ensured start and end date timestamp and overrided availability time test', () => {
        let serviceSandbox: sinon.SinonSandbox;

        const timezoneMock = 'Asia/Seoul';

        let localizeDateTimeStub: sinon.SinonStub<[date: Date, timezone: string, timeString: string, overrideOptions?: { day: number } | null | undefined], Date>;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
            localizeDateTimeStub = serviceSandbox.stub(service, 'localizeDateTime');
        });

        afterEach(() => {
            serviceSandbox.reset();
            serviceSandbox.restore();
        });

        // expected result true means request schedule data is invalid.
        [
            {
                description: 'should be returned false if there is overrided availability but they have no time range without overlapping',
                timezoneMock,
                overrideMock: {
                    targetDate: new Date('2023-08-25T00:00:00'),
                    timeRanges: []
                },
                startDateTimestampMock: new Date('2023-08-24T00:00:01').getTime(),
                endDateTimestampMock: new Date('2023-08-24T01:00:01').getTime(),
                localizeDateTimeStubOnFirstCall: new Date('this is Invalid date'),
                localizeDateTimeStubOnSecondCall: new Date('this is Invalid date'),
                expectedLocalizeDateTimeCallCount: 0,
                expectedResult: false
            },
            {
                description: 'should be returned true if there is unavailable override but they have no time range with overlapping',
                timezoneMock,
                overrideMock: {
                    targetDate: new Date('2023-08-25T00:00:00'),
                    timeRanges: []
                },
                startDateTimestampMock: new Date('2023-08-24T00:00:01').getTime(),
                endDateTimestampMock: new Date('2023-08-25T00:10:00').getTime(),
                localizeDateTimeStubOnFirstCall: new Date('this is Invalid date'),
                localizeDateTimeStubOnSecondCall: new Date('this is Invalid date'),
                expectedLocalizeDateTimeCallCount: 0,
                expectedResult: true
            },
            {
                description: 'should be returned false if there are overrided availability time, and the ensured start time and end time both are not included in the available time in override',
                timezoneMock,
                overrideMock: {
                    targetDate: new Date('2023-08-25T00:00:00'),
                    timeRanges: [
                        {
                            startTime: '09:00:00',
                            endTime: '11:00:00'
                        } as TimeRange
                    ]
                } as OverridedAvailabilityTime,
                startDateTimestampMock: new Date('2023-08-25T09:00:00').getTime(),
                endDateTimestampMock: new Date('2023-08-25T10:00:00').getTime(),
                localizeDateTimeStubOnFirstCall: new Date('2023-08-25T09:00:00'),
                localizeDateTimeStubOnSecondCall: new Date('2023-08-25T11:00:00'),
                expectedLocalizeDateTimeCallCount: 2,
                expectedResult: false
            },
            {
                description: 'should be returned true if there are overrided availability time, and the ensured start time and end time both are included in the available time in override',
                timezoneMock,
                overrideMock: {
                    targetDate: new Date('2023-08-25T00:00:00'),
                    timeRanges: [
                        {
                            startTime: '09:00:00',
                            endTime: '11:00:00'
                        } as TimeRange
                    ]
                } as OverridedAvailabilityTime,
                startDateTimestampMock: new Date('2023-08-25T08:00:00').getTime(),
                endDateTimestampMock: new Date('2023-08-25T09:00:00').getTime(),
                localizeDateTimeStubOnFirstCall: new Date('2023-08-25T09:00:00'),
                localizeDateTimeStubOnSecondCall: new Date('2023-08-25T11:00:00'),
                expectedLocalizeDateTimeCallCount: 2,
                expectedResult: false
            }
        ].forEach(function ({
            description,
            timezoneMock,
            overrideMock,
            startDateTimestampMock,
            endDateTimestampMock,
            localizeDateTimeStubOnFirstCall,
            localizeDateTimeStubOnSecondCall,
            expectedLocalizeDateTimeCallCount,
            expectedResult
        }) {
            it(description, () => {

                localizeDateTimeStub.onFirstCall().returns(localizeDateTimeStubOnFirstCall);
                localizeDateTimeStub.onSecondCall().returns(localizeDateTimeStubOnSecondCall);

                const isTimeOverlappedWithOverrides = service.isTimeOverlappingWithAvailableTimeOverrides(
                    timezoneMock,
                    overrideMock,
                    startDateTimestampMock,
                    endDateTimestampMock
                );

                expect(localizeDateTimeStub.callCount).to.be.at.least(expectedLocalizeDateTimeCallCount);
                expect(isTimeOverlappedWithOverrides).equal(expectedResult);
            });
        });
    });

    describe('Test for verifying the overlap between ensured start and end date timestamp and available times', () => {
        let serviceSandbox: sinon.SinonSandbox;

        const testUTCDate = new Date('2023-08-16T08:00:00.000Z');
        const testDateTimestamp = testUTCDate.getTime();

        const timezoneMock = 'Asia/Seoul';

        let dateToTimeStringStub: sinon.SinonStub<[date: Date, timezone: string], string>;
        let localizeDateTimeStub: sinon.SinonStub<[date: Date, timezone: string, timeString: string, overrideOptions?: { day: number } | null | undefined], Date>;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            dateToTimeStringStub = serviceSandbox.stub(service, 'dateToTimeString');
            localizeDateTimeStub = serviceSandbox.stub(service, 'localizeDateTime');
        });

        afterEach(() => {
            dateToTimeStringStub.reset();
            localizeDateTimeStub.reset();
            serviceSandbox.restore();
        });

        [
            {
                description: 'should be returned false if there is no availability time',
                availableTimesMock: [],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(testDateTimestamp - _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + _1Hour),
                isTimeOverlappingWithStartDateTimeStub: true,
                isTimeOverlappingWithEndDateTimeStub: true,
                expectedResult: false
            },
            {
                description: 'should be returned false if there are availability times, and both the ensured start time and end time are not included in any availability time',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: testDateTimestamp - 3 * _1Hour,
                                endTime: testDateTimestamp - 2 * _1Hour
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(testDateTimestamp - _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + _1Hour),
                isTimeOverlappingWithStartDateTimeStub: false,
                isTimeOverlappingWithEndDateTimeStub: false,
                expectedResult: false
            },
            {
                description: 'should be returned false if there are availability times, and the ensured start time is included in any availability time, but end time is not',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: testDateTimestamp - 3 * _1Hour,
                                endTime: testDateTimestamp + 2 * _1Hour
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(testDateTimestamp - _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + 3 * _1Hour),
                isTimeOverlappingWithStartDateTimeStub: true,
                isTimeOverlappingWithEndDateTimeStub: false,
                expectedResult: false
            },
            {
                description: 'should be returned false if there are availability times, and the ensured end time is included in any availability time, but start time is not',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: testDateTimestamp - 3 * _1Hour,
                                endTime: testDateTimestamp + 2 * _1Hour
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(testDateTimestamp - 4 * _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + _1Hour),
                isTimeOverlappingWithStartDateTimeStub: false,
                isTimeOverlappingWithEndDateTimeStub: true,
                expectedResult: false
            },
            {
                description: 'should be returned true if there are availability times, and at least one of the ensured start time and end time is included in the availability time',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: testDateTimestamp - 2 * _1Hour,
                                endTime: testDateTimestamp + 2 * _1Hour
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(testDateTimestamp - _1Hour),
                endDateTimeMock: new Date(testDateTimestamp + _1Hour),
                isTimeOverlappingWithStartDateTimeStub: true,
                isTimeOverlappingWithEndDateTimeStub: true,
                expectedResult: true
            }

        ].forEach(function ({
            description,
            availableTimesMock,
            availabilityTimezone,
            startDateTimeMock,
            endDateTimeMock,
            isTimeOverlappingWithStartDateTimeStub,
            isTimeOverlappingWithEndDateTimeStub,
            expectedResult
        }) {
            it(description, () => {
                dateToTimeStringStub.onFirstCall().returns('startTimeStringStub');
                dateToTimeStringStub.onSecondCall().returns('endTimeStringStub');

                localizeDateTimeStub.onFirstCall().returns(startDateTimeMock);
                localizeDateTimeStub.onSecondCall().returns(endDateTimeMock);

                const startWeekdayAvailableTimeStub = availableTimesMock.find((_availableTimeMock) => _availableTimeMock.day === startDateTimeMock.getDay());
                const endWeekdayAvailableTimeStub = availableTimesMock.find((_availableTimeMock) => _availableTimeMock.day === endDateTimeMock.getDay());

                const isTimeOverlappingWithAvailableTimeRangeStub = serviceSandbox.stub(service, 'isTimeOverlappingWithAvailableTimeRange')
                    .onFirstCall().returns(isTimeOverlappingWithStartDateTimeStub)
                    .onSecondCall().returns(isTimeOverlappingWithEndDateTimeStub);

                const isTimeOverlapping = service.isTimeOverlappingWithAvailableTimes(availableTimesMock, availabilityTimezone, startDateTimeMock, endDateTimeMock);

                if (startWeekdayAvailableTimeStub && endWeekdayAvailableTimeStub) {
                    expect(isTimeOverlappingWithAvailableTimeRangeStub.calledTwice).true;
                } else {
                    expect(isTimeOverlappingWithAvailableTimeRangeStub.called).false;
                }

                expect(dateToTimeStringStub.calledTwice).true;
                expect(localizeDateTimeStub.calledTwice).true;
                expect(isTimeOverlapping).equal(expectedResult);
            });
        });
    });

    describe('Test ', () => {

        let localizeDateTimeStub: sinon.SinonStub<[date: Date, timezone: string, timeString: string, overrideOptions?: { day: number } | null | undefined], Date>;

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            localizeDateTimeStub = serviceSandbox.stub(service, 'localizeDateTime');
        });

        afterEach(() => {
            localizeDateTimeStub.reset();

            serviceSandbox.restore();
        });

        it('should be returned true for time calculation with inclusively', () => {
            const date = new Date('2023-07-21T13:00:00.000Z');
            const timezone = 'America/New_York';

            const overridedAvailabilityTimeMock = testMockUtil.getOverridedAvailabilityTimeMock();
            const timeRangesMock = overridedAvailabilityTimeMock.timeRanges;

            const localizedDateStub = new Date('2023-07-21T13:00:00.000Z');
            localizeDateTimeStub.returns(localizedDateStub);

            const result = service.isTimeOverlappingWithAvailableTimeRange(date, timezone, timeRangesMock);

            expect(result).true;
            expect(localizeDateTimeStub.called).true;
        });
    });
});
