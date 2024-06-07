import { Test, TestingModule } from '@nestjs/testing';
import * as icsModule from 'ics';
import { BadRequestException } from '@nestjs/common';
import { Weekday } from '@interfaces/availabilities/weekday.enum';
import { TimeSlotCompare } from '@interfaces/scheduled-events/time-slot-compare.enum';
import { QuestionType } from '@interfaces/events/event-details/question-type.enum';
import { Host } from '@entity/scheduled-events/host.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { AvailableTime } from '@entity/availability/availability-time.entity';
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
            providers: [
                TimeUtilService,
                TestMockUtil.getLoggerProviderMock()
            ]
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

    describe('intersectAvailability Test', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        it('should be calculated the intersect availablility', () => {
            const availabilityA = stubOne(Availability, {
                timezone: 'Asia/Seoul'
            });
            const availabilityB = stubOne(Availability, {
                timezone: 'Asia/Seoul'
            });

            const availableTimesStub = stub(AvailableTime);

            serviceSandbox.stub(service, 'intersectAvailableTimes').returns(availableTimesStub);
            serviceSandbox.stub(service, 'intersectOverridedAvailableTimes').returns([]);
            serviceSandbox.stub(service, 'intersectOverrideWithAvailableTimes').returns([]);

            const actual = service.intersectAvailability(availabilityA, availabilityB);

            expect(actual).ok;
        });
    });

    describe('Intersect overrided available times', () => {

        [
            {
                description: 'should be parsed targetDate string which is patched from NoSQL: Redis',
                overridedAvailableTimesA: [
                    {
                        targetDate: '2024-02-14T00:00:00.000Z' as unknown as Date,
                        timeRanges: [{ startTime: '09:00', endTime: '17:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [
                    {
                        targetDate: '2024-02-14T00:00:00.000Z' as unknown as Date,
                        timeRanges: [{ startTime: '08:00', endTime: '19:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                expected: [
                    {
                        targetDate: new Date('2024-02-14T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '17:00' }]
                    }
                ] as OverridedAvailabilityTime[]
            },
            {
                description: 'should be calculated intersect overrided available times',
                overridedAvailableTimesA: [
                    {
                        targetDate: new Date('2024-02-14T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '17:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [
                    {
                        targetDate: new Date('2024-02-14T00:00:00.000Z'),
                        timeRanges: [{ startTime: '08:00', endTime: '19:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                expected: [
                    {
                        targetDate: new Date('2024-02-14T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '17:00' }]
                    }
                ] as OverridedAvailabilityTime[]
            },
            {
                description: 'should be calculated intersect overrided available times with unavailable overridings',
                overridedAvailableTimesA: [
                    {
                        targetDate: new Date('2024-02-14T00:00:00.000Z'),
                        timeRanges: []
                    },
                    {
                        targetDate: new Date('2024-02-16T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '17:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [
                    {
                        targetDate: new Date('2024-02-16T00:00:00.000Z'),
                        timeRanges: [{ startTime: '08:00', endTime: '19:00' }]
                    },
                    {
                        targetDate: new Date('2024-02-14T00:00:00.000Z'),
                        timeRanges: [{ startTime: '10:00', endTime: '19:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                expected: [
                    {
                        targetDate: new Date('2024-02-16T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '17:00' }]
                    },
                    {
                        targetDate: new Date('2024-02-14T00:00:00.000Z'),
                        timeRanges: []
                    }
                ] as OverridedAvailabilityTime[]
            },
            {
                description: 'should be calculated intersect overrided available times including same date unavailable date',
                overridedAvailableTimesA: [
                    {
                        targetDate: new Date('2024-02-18T00:00:00.000Z'),
                        timeRanges: []
                    },
                    {
                        targetDate: new Date('2024-02-16T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '17:00' }]
                    },
                    {
                        targetDate: new Date('2024-02-15T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '17:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [
                    {
                        targetDate: new Date('2024-02-18T00:00:00.000Z'),
                        timeRanges: []
                    },
                    {
                        targetDate: new Date('2024-02-16T00:00:00.000Z'),
                        timeRanges: [
                            { startTime: '00:00', endTime: '02:00' },
                            { startTime: '13:00', endTime: '17:30' },
                            { startTime: '18:00', endTime: '19:00' }
                        ]
                    },
                    {
                        targetDate: new Date('2024-02-15T00:00:00.000Z'),
                        timeRanges: [{ startTime: '08:00', endTime: '19:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                expected: [
                    {
                        targetDate: new Date('2024-02-18T00:00:00.000Z'),
                        timeRanges: []
                    },
                    {
                        targetDate: new Date('2024-02-16T00:00:00.000Z'),
                        timeRanges: [{ startTime: '13:00', endTime: '17:00' }]
                    },
                    {
                        targetDate: new Date('2024-02-15T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '17:00' }]
                    }
                ] as OverridedAvailabilityTime[]
            },
            {
                description: 'should be calculated intersect overrided available times for unavailable date with no same target date (#822)',
                overridedAvailableTimesA: [
                    { targetDate: new Date('2024-03-29T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-18T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-16T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-15T00:00:00.000Z'), timeRanges: [] }
                ] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [
                    { targetDate: new Date('2024-03-27T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-26T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-25T00:00:00.000Z'), timeRanges: [] }
                ] as OverridedAvailabilityTime[],
                expected: [
                    { targetDate: new Date('2024-03-29T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-27T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-26T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-25T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-18T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-16T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-15T00:00:00.000Z'), timeRanges: [] }
                ] as OverridedAvailabilityTime[]
            },
            {
                description: 'should be ignored available date with unavailable date (#822)',
                overridedAvailableTimesA: [
                    {
                        targetDate: new Date('2024-03-29T00:00:00.000Z'),
                        timeRanges: [{ startTime: '13:00', endTime: '17:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [
                    { targetDate: new Date('2024-03-29T00:00:00.000Z'), timeRanges: [] }
                ] as OverridedAvailabilityTime[],
                expected: [
                    { targetDate: new Date('2024-03-29T00:00:00.000Z'), timeRanges: [] }
                ] as OverridedAvailabilityTime[]
            },
            {
                description: 'it should be prioritized unavailable setting than a specific overrided time (#822)',
                overridedAvailableTimesA: [
                    {
                        targetDate: new Date('2024-03-29T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '14:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [
                    {
                        targetDate: new Date('2024-03-29T00:00:00.000Z'),
                        timeRanges: []
                    }
                ] as OverridedAvailabilityTime[],
                expected: [
                    {
                        targetDate: new Date('2024-03-29T00:00:00.000Z'),
                        timeRanges: []
                    }
                ] as OverridedAvailabilityTime[]
            },
            {
                description: 'it should be prioritized a specific overrided time than no override setting if no override is located on second args (#822)',
                overridedAvailableTimesA: [] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [
                    {
                        targetDate: new Date('2024-03-29T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '14:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                expected: [
                    {
                        targetDate: new Date('2024-03-29T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '14:00' }]
                    }
                ] as OverridedAvailabilityTime[]
            },
            {
                description: 'it should be prioritized a specific overrided time than no override setting if no override is located on second args (#822)',
                overridedAvailableTimesA: [
                    {
                        targetDate: new Date('2024-03-29T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '14:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [] as OverridedAvailabilityTime[],
                expected: [
                    {
                        targetDate: new Date('2024-03-29T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '14:00' }]
                    }
                ] as OverridedAvailabilityTime[]
            },
            {
                description: 'it should be prioritized a specific overrided time for 2024.03.18 than no override setting with ACTUAL CASE',
                overridedAvailableTimesA: [
                    {
                        targetDate: new Date('2024-03-18T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '14:00' }]
                    },
                    { targetDate: new Date('2024-03-16T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-15T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-14T00:00:00.000Z'), timeRanges: [] }
                ] as OverridedAvailabilityTime[],
                overridedAvailableTimesB: [
                    { targetDate: new Date('2024-03-22T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-21T00:00:00.000Z'), timeRanges: [] },
                    {
                        targetDate: new Date('2024-03-19T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '14:00' }]
                    }
                ] as OverridedAvailabilityTime[],
                expected: [
                    { targetDate: new Date('2024-03-22T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-21T00:00:00.000Z'), timeRanges: [] },
                    {
                        targetDate: new Date('2024-03-19T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '14:00' }]
                    },
                    {
                        targetDate: new Date('2024-03-18T00:00:00.000Z'),
                        timeRanges: [{ startTime: '09:00', endTime: '14:00' }]
                    },
                    { targetDate: new Date('2024-03-16T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-15T00:00:00.000Z'), timeRanges: [] },
                    { targetDate: new Date('2024-03-14T00:00:00.000Z'), timeRanges: [] }
                ] as OverridedAvailabilityTime[]
            }
        ].forEach(function({
            description,
            overridedAvailableTimesA,
            overridedAvailableTimesB,
            expected
        }) {
            it(description, () => {

                const actual = service.intersectOverridedAvailableTimes(
                    overridedAvailableTimesA,
                    overridedAvailableTimesB
                );

                expect(actual).to.deep.equals(expected);
            });
        });
    });

    describe('Intersect Available Times', () => {
        [
            {
                description: 'should be calculated intersect available times',
                availableTimesA: [
                    {
                        day: Weekday.MONDAY,
                        timeRanges: [
                            { startTime: '17:00', endTime: '20:00' }
                        ]
                    },
                    {
                        day: Weekday.TUESDAY,
                        timeRanges: [
                            { startTime: '15:00', endTime: '20:00' }
                        ]
                    },
                    {
                        day: Weekday.WEDNESDAY,
                        timeRanges: [
                            { startTime: '10:00', endTime: '15:00' }
                        ]
                    }
                ] as AvailableTime[],
                availableTimesB: [
                    {
                        day: Weekday.SUNDAY,
                        timeRanges: [
                            { startTime: '00:00', endTime: '02:00' }
                        ]
                    },
                    {
                        day: Weekday.MONDAY,
                        timeRanges: [
                            { startTime: '15:00', endTime: '18:00' }
                        ]
                    },
                    {
                        day: Weekday.WEDNESDAY,
                        timeRanges: [
                            { startTime: '10:00', endTime: '12:00' }
                        ]
                    }
                ] as AvailableTime[],
                expectedIntersectAvailableTimes:  [
                    {
                        day: Weekday.MONDAY,
                        timeRanges: [
                            { startTime: '17:00', endTime: '18:00' }
                        ]
                    },
                    {
                        day: Weekday.WEDNESDAY,
                        timeRanges: [
                            { startTime: '10:00', endTime: '12:00' }
                        ]
                    }
                ] as AvailableTime[]
            }
        ].forEach(function({
            description,
            availableTimesA,
            availableTimesB,
            expectedIntersectAvailableTimes
        }) {
            it(description, () => {
                const actual = service.intersectAvailableTimes(availableTimesA, availableTimesB);
                expect(actual).deep.equal(expectedIntersectAvailableTimes);
            });
        });
    });

    describe('intersectTimeRanges Test', () => {
        [
            {
                description: 'should be calculated intersect time ranges',
                timeRangesA: [
                    { startTime: '17:00', endTime: '18:00' }
                ] as TimeRange[],
                timeRangesB: [
                    { startTime: '15:00', endTime: '20:00' }
                ] as TimeRange[],
                expectedIntersectTimeRanges:  [
                    { startTime: '17:00', endTime: '18:00' }
                ] as TimeRange[]
            },
            {
                description: 'should be calculated intersect time ranges',
                timeRangesA: [
                    { startTime: '15:00', endTime: '20:00' }
                ] as TimeRange[],
                timeRangesB: [
                    { startTime: '17:00', endTime: '18:00' }
                ] as TimeRange[],
                expectedIntersectTimeRanges:  [
                    { startTime: '17:00', endTime: '18:00' }
                ] as TimeRange[]
            },
            {
                description: 'should be calculated intersect time ranges: empty slot should be removed',
                timeRangesA: [
                    { startTime: '10:00', endTime: '19:30' }
                ] as TimeRange[],
                timeRangesB: [
                    { startTime: '10:30', endTime: '12:30' },
                    { startTime: '13:30', endTime: '18:00' },
                    { startTime: '19:30', endTime: '20:00' }
                ] as TimeRange[],
                expectedIntersectTimeRanges:  [
                    { startTime: '10:30', endTime: '12:30' },
                    { startTime: '13:30', endTime: '18:00' }
                ] as TimeRange[]
            },
            {
                description: 'should be calculated intersect time ranges: empty slot should be removed',
                timeRangesA: [
                    { startTime: '08:00', endTime: '11:30' },
                    { startTime: '12:30', endTime: '21:30' }
                ] as TimeRange[],
                timeRangesB: [
                    { startTime: '08:30', endTime: '12:30' },
                    { startTime: '13:30', endTime: '15:00' },
                    { startTime: '16:30', endTime: '18:00' },
                    { startTime: '19:30', endTime: '23:00' }
                ] as TimeRange[],
                expectedIntersectTimeRanges:  [
                    { startTime: '08:30', endTime: '11:30' },
                    { startTime: '13:30', endTime: '15:00' },
                    { startTime: '16:30', endTime: '18:00' },
                    { startTime: '19:30', endTime: '21:30' }
                ] as TimeRange[]
            }
        ].forEach(function({
            description,
            timeRangesA,
            timeRangesB,
            expectedIntersectTimeRanges
        }) {
            it(description, () => {
                const actualIntersectTimeRanges = service.intersectTimeRanges(timeRangesA, timeRangesB);

                expect(actualIntersectTimeRanges).to.deep.equal(expectedIntersectTimeRanges);
            });
        });
    });

    describe('Intersect available times and available overrides', () => {

        [
            {
                description: 'should be prioritized the unavailable time than override',
                availabilityMock: {
                    availableTimes : [ { day: Weekday.WEDNESDAY } ],
                    overrides: [
                        {
                            // Thursday
                            targetDate: new Date('2024-03-21T00:00:00.000Z'),
                            timeRanges: []
                        },
                        {
                            // Friday
                            targetDate: new Date('2024-03-22T00:00:00.000Z'),
                            timeRanges: [ { startTime: '09:00:00', endTime: '12:00:00' } ]
                        }
                    ] as Availability['overrides']
                } as unknown as Availability,
                expectedOverrides: []
            },
            {
                description: 'should be prioritized the unavailable time than override',
                availabilityMock: {
                    availableTimes : [
                        {
                            day: Weekday.THURSDAY,
                            timeRanges: [ { startTime: '08:00:00', endTime: '11:00:00' } ]
                        }
                    ] as Availability['availableTimes'],
                    overrides: [
                        {
                            // Thursday
                            targetDate: new Date('2024-03-21T00:00:00.000Z'),
                            timeRanges: [ { startTime: '09:00:00', endTime: '12:00:00' } ]
                        }
                    ] as Availability['overrides']
                } as unknown as Availability,
                expectedOverrides: [
                    {
                        // Thursday
                        targetDate: new Date('2024-03-21T00:00:00.000Z'),
                        timeRanges: [ { startTime: '09:00:00', endTime: '11:00:00' } ]
                    }
                ]
            }
        ].forEach(function({
            description,
            availabilityMock,
            expectedOverrides
        }) {
            it(description, () => {
                const intersectOverrides = service.intersectOverrideWithAvailableTimes(
                    availabilityMock.overrides,
                    availabilityMock.availableTimes
                );

                expect(intersectOverrides).ok;
                expect(intersectOverrides).deep.equals(expectedOverrides);
            });
        });
    });

    describe('Test compareTimeSlot', () => {

        [
            {
                description: 'should return the correct minimum time slot',
                timeSlotA: '10:30',
                timeSlotB: '11:15',
                timeSlotCompare: TimeSlotCompare.MIN
            },
            {
                description: 'should return the correct maximum time slot',
                timeSlotA: '13:45',
                timeSlotB: '12:30',
                timeSlotCompare: TimeSlotCompare.MAX
            }
        ].forEach(function({
            description,
            timeSlotA,
            timeSlotB,
            timeSlotCompare
        }) {
            it(description, () => {

                const result = service.compareTimeSlot(timeSlotA, timeSlotB, timeSlotCompare);

                expect(result).eqls(timeSlotA);
            });
        });

        it('should handle equal hours correctly', () => {
            const timeSlotA = '09:00';
            const timeSlotB = '09:30';
            const minimum: TimeSlotCompare.MIN = 0;
            const maximum: TimeSlotCompare.MAX = 1;

            const resultMin = service.compareTimeSlot(timeSlotA, timeSlotB, minimum);
            const resultMax = service.compareTimeSlot(timeSlotA, timeSlotB, maximum);

            expect(resultMin).eqls(timeSlotA);
            expect(resultMax).eqls(timeSlotB);
        });
    });

    describe('localizeDateTime Test', () => {

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
    });

    describe('ICS String convert Test', () => {

        it('should be converted to ics string', () => {
            const uuidMock = 'AABBCCDDEEFF';
            const organizerEmailMock = TestMockUtil.faker.internet.email();
            const scheduledEventMock = stubOne(ScheduledEvent, {
                scheduledTime: {
                    startTimestamp: new Date(),
                    endTimestamp: new Date()
                },
                host: {
                    name: 'hostName'
                } as Host,
                hostProfiles: [],
                invitees: [
                    {
                        name: 'alan',
                        email: 'alan@sync.day',
                        locale: 'ko-KR',
                        phoneNumber: '',
                        timezone: 'Asia/Seoul'
                    }
                ],
                inviteeAnswers: [
                    {
                        priority: 1,
                        type:  QuestionType.TEXT,
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
                scheduledEventMock
            );

            expect(convertedICSString).ok;
        });

        it('should be converted to ics string without METHOD: string for RFC ', () => {
            const uuidMock = 'AABBCCDDEEFF';
            const organizerEmailMock = TestMockUtil.faker.internet.email();
            const scheduledEventMock = stubOne(ScheduledEvent, {
                scheduledTime: {
                    startTimestamp: new Date(),
                    endTimestamp: new Date()
                },
                host: {
                    name: 'hostName'
                } as Host,
                hostProfiles: [],
                invitees: [
                    {
                        name: 'alan',
                        email: 'alan@sync.day',
                        locale: 'ko-KR',
                        phoneNumber: '',
                        timezone: 'Asia/Seoul'
                    }
                ],
                inviteeAnswers: [
                    {
                        priority: 1,
                        type:  QuestionType.TEXT,
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
                scheduledEventMock
            );

            expect(actualConvertedICSString).ok;
            expect(actualConvertedICSString).equals(expectedICSString);
        });

        it('should be thrown an error for ics converting error', () => {
            const uuidMock = 'AABBCCDDEEFF';
            const organizerEmailMock = TestMockUtil.faker.internet.email();
            const scheduledEventMock = stubOne(ScheduledEvent, {
                scheduledTime: {
                    startTimestamp: new Date(),
                    endTimestamp: new Date()
                },
                host: {
                    name: 'hostName'
                } as Host,
                hostProfiles: [],
                invitees: [
                    {
                        name: 'alan',
                        email: 'alan@sync.day',
                        locale: 'ko-KR',
                        phoneNumber: '',
                        timezone: 'Asia/Seoul'
                    }
                ],
                inviteeAnswers: [
                    {
                        priority: 1,
                        type:  QuestionType.TEXT,
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
                scheduledEventMock
            )).throws(BadRequestException);
        });
    });

    it('should be got a timezone gmt string', () => {
        const timezone = 'Asia/Seoul';
        const expectedGMTString = 'GMT+09:00';

        const actualGMTString = service.getTimezoneGMTString(timezone);

        expect(actualGMTString).equals(expectedGMTString);
    });

    describe('Test for ensured scheduled event start time and end time compare with now test', () => {
        [
            {
                description: 'should be returned true if the ensured scheduled event start time is earlier than now',
                startDateTimestampMock: Date.now() - _1Hour,
                ensuredEndDateTimestampMock: Date.now() + _1Hour,
                expectedResult: true
            },
            {
                description: 'should be returned true if the ensured scheduled event end time is earlier than now',
                startDateTimestampMock: Date.now() + _1Hour,
                ensuredEndDateTimestampMock: Date.now() - _1Hour,
                expectedResult: true
            },
            {
                description: 'should be returned false if both the ensured scheduled event start time and end time are later than now',
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

        // expected result true means request scheduled event data is invalid.
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
                startDateTimestampMock: new Date('2023-08-25T08:00:00').getTime(),
                endDateTimestampMock: new Date('2023-08-25T12:00:00').getTime(),
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
                startDateTimestampMock: new Date('2023-08-25T09:00:00').getTime(),
                endDateTimestampMock: new Date('2023-08-25T10:00:00').getTime(),
                localizeDateTimeStubOnFirstCall: new Date('2023-08-25T09:00:00'),
                localizeDateTimeStubOnSecondCall: new Date('2023-08-25T11:00:00'),
                expectedLocalizeDateTimeCallCount: 2,
                expectedResult: true
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
                                startTime: new Date(testDateTimestamp - 3 * _1Hour).toISOString(),
                                endTime: new Date(testDateTimestamp - 2 * _1Hour).toISOString()
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
                                startTime: new Date(testDateTimestamp - 3 * _1Hour).toISOString(),
                                endTime: new Date(testDateTimestamp + 2 * _1Hour).toISOString()
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
                                startTime: new Date(testDateTimestamp - 3 * _1Hour).toISOString(),
                                endTime: new Date(testDateTimestamp + 2 * _1Hour).toISOString()
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
                /**
                 * @see {@link [Cannot book when hosts have different time zones](syncday/syncday-frontend#1437)}
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
                isTimeOverlappingWithStartDateTimeStub: true,
                isTimeOverlappingWithEndDateTimeStub: true,
                expectedResult: true
            },
            {
                description: 'should be returned true if there are availability times, and at least one of the ensured start time and end time is included in the availability time',
                availableTimesMock: [
                    {
                        day: testUTCDate.getUTCDay() as Weekday,
                        timeRanges: [
                            {
                                startTime: new Date(testDateTimestamp - 2 * _1Hour).toISOString(),
                                endTime: new Date(testDateTimestamp + 2 * _1Hour).toISOString()
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

    describe('Test getOverridedAvailabilityTimeMock', () => {

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

    it('it should be validated that start, end time is in available time', () => {

        const availableTimes = [
            { day: 1, timeRanges: [{ startTime: '09:00:00', endTime: '17:00:00' }] },
            { day: 2, timeRanges: [{ startTime: '09:00:00', endTime: '17:00:00' }] },
            { day: 3, timeRanges: [{ startTime: '09:00:00', endTime: '17:00:00' }] },
            { day: 4, timeRanges: [{ startTime: '09:00:00', endTime: '17:00:00' }] },
            { day: 5, timeRanges: [{ startTime: '09:00:00', endTime: '17:00:00' }] }
        ] as AvailableTime[];

        const availabilityTimezone = 'Asia/Seoul';
        const startDateTime = new Date('Mon Nov 20 2023 00:30:00 GMT+0000 (Coordinated Universal Time)');
        const endDateTime = new Date('Mon Nov 20 2023 01:00:00 GMT+0000 (Coordinated Universal Time)');

        const result = service.isTimeOverlappingWithAvailableTimes(
            availableTimes,
            availabilityTimezone,
            startDateTime,
            endDateTime
        );

        expect(result).true;
    });

    it('should be validated that the localized start date time fall within host\'s time range, taking into account timezone calculation', () => {

        const localizedStartDateTime = new Date('Mon Nov 20 2023 09:30:00 GMT+0900 (Korean Standard Time');
        const availabilityTimezone = 'Asia/Seoul';
        const startTimeRanges = [{ startTime: '09:00:00', endTime: '17:00:00' }] ;

        const isTimeOverlappingWithStartDateTime = service.isTimeOverlappingWithAvailableTimeRange(
            localizedStartDateTime,
            availabilityTimezone,
            startTimeRanges
        );

        expect(isTimeOverlappingWithStartDateTime).true;
    });
});
