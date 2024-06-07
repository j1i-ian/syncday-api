import { INestApplication } from '@nestjs/common';
import { Weekday } from '@interfaces/availabilities/weekday.enum';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { TimeRange } from '@entity/events/time-range.entity';
import { AvailableTime } from '@entity/availability/availability-time.entity';
import { TestIntegrationUtil } from './test-integration-util';

const testIntegrationUtil = new TestIntegrationUtil();

describe('TimeUtilService Integration Spec', () => {

    let app: INestApplication;

    let service: TimeUtilService;

    const _1Hour = 60 * 60 * 1000;

    before(async () => {

        app = await testIntegrationUtil.initializeApp();
        service = app.get<TimeUtilService>(TimeUtilService);
    });

    after(() => {

        testIntegrationUtil.reset();

        sinon.restore();
    });

    describe('Test for verifying the overlap between ensured start and end date timestamp and available times', () => {

        const testUTCDate = new Date('2023-08-16T08:00:00.000Z');
        const testDateTimestamp = testUTCDate.getTime();

        const timezoneMock = 'Asia/Seoul';

        [
            {
                description: 'should be returned false if there is no availability time',
                availableTimesMock: [],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(
                    testDateTimestamp - _1Hour
                ),
                endDateTimeMock: new Date(
                    testDateTimestamp + _1Hour
                ),
                expectedResult: false
            },
            {
                description: 'should be returned false if there are availability times, and both the ensured start time and end time are not included in any availability time',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: new Date(
                                    testDateTimestamp - 3 * _1Hour
                                ).toISOString(),
                                endTime: new Date(
                                    testDateTimestamp - 2 * _1Hour
                                ).toISOString()
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(
                    testDateTimestamp - _1Hour
                ),
                endDateTimeMock: new Date(
                    testDateTimestamp + _1Hour
                ),
                expectedResult: false
            },
            {
                description: 'should be returned false if there are availability times, and the ensured start time is included in any availability time, but end time is not',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: new Date(
                                    testDateTimestamp - 3 * _1Hour
                                ).toISOString(),
                                endTime: new Date(
                                    testDateTimestamp + 2 * _1Hour
                                ).toISOString()
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(
                    testDateTimestamp - _1Hour
                ),
                endDateTimeMock: new Date(
                    testDateTimestamp + 3 * _1Hour
                ),
                expectedResult: false
            },
            {
                description: 'should be returned false if there are availability times, and the ensured end time is included in any availability time, but start time is not',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: new Date(
                                    testDateTimestamp - 3 * _1Hour
                                ).toISOString(),
                                endTime: new Date(
                                    testDateTimestamp + 2 * _1Hour
                                ).toISOString()
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(
                    testDateTimestamp - 4 * _1Hour
                ),
                endDateTimeMock: new Date(
                    testDateTimestamp + _1Hour
                ),
                expectedResult: false
            },
            {
                /**
                 * @see {@link [Cannot book when hosts have different time zones](syncday/syncday-frontend#907)}
                 */
                description: 'should be returned true with availability times, at least one of the ensured start time and end time is included in the availability time',
                availableTimesMock: [
                    {
                        day: 1,
                        timeRanges: []
                    },
                    {
                        day: 2,
                        timeRanges: [
                            { startTime: '09:00', endTime: '12:00' }
                        ]
                    },
                    {
                        day: 3,
                        timeRanges: [
                            { startTime: '09:00', endTime: '12:00' }
                        ]
                    },
                    {
                        day: 4,
                        timeRanges: [
                            { startTime: '09:00', endTime: '12:00' }
                        ]
                    },
                    {
                        day: 5,
                        timeRanges: [
                            { startTime: '09:00', endTime: '12:00' }
                        ]
                    }
                ],
                availabilityTimezone: 'America/Anguilla',
                startDateTimeMock: new Date('2024-06-06T01:00:00.000Z'),
                endDateTimeMock: new Date('2024-06-06T01:30:00.000Z'),
                expectedResult: true
            },
            {
                description: 'should be returned true if there are availability times, and at least one of the ensured start time and end time is included in the availability time',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: new Date(
                                    testDateTimestamp - 2 * _1Hour
                                ).toISOString(),
                                endTime: new Date(
                                    testDateTimestamp + 2 * _1Hour
                                ).toISOString()
                            } as TimeRange
                        ]
                    } as AvailableTime
                ],
                availabilityTimezone: timezoneMock,
                startDateTimeMock: new Date(
                    testDateTimestamp - _1Hour
                ),
                endDateTimeMock: new Date(
                    testDateTimestamp + _1Hour
                ),
                expectedResult: true
            }
        ].forEach(function ({
            description,
            availableTimesMock,
            availabilityTimezone,
            startDateTimeMock,
            endDateTimeMock,
            expectedResult
        }) {
            it(description, () => {
                const isTimeOverlapping = service.isTimeOverlappingWithAvailableTimes(
                    availableTimesMock,
                    availabilityTimezone,
                    startDateTimeMock,
                    endDateTimeMock
                );

                expect(isTimeOverlapping).equal(expectedResult);
            });
        });
    });

});
