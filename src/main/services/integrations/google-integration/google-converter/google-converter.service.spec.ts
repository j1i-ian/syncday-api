import { Test, TestingModule } from '@nestjs/testing';
import { calendar_v3 } from 'googleapis';
import { Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { QuestionType } from '@interfaces/events/event-details/question-type.enum';
import { HostProfile } from '@interfaces/scheduled-events/host-profile.interface';
import { UtilService } from '@services/util/util.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { GoogleIntegrationScheduledEvent } from '@entity/integrations/google/google-integration-scheduled-event.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { ScheduledTimeset } from '@entity/scheduled-events/scheduled-timeset.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { Host } from '@entity/scheduled-events/host.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleConverterService } from './google-converter.service';

const testMockUtil = new TestMockUtil();

describe('GoogleConverterService', () => {
    let service: GoogleConverterService;

    let loggerStub: sinon.SinonStubbedInstance<Logger>;

    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let timeUtilServiceStub: sinon.SinonStubbedInstance<TimeUtilService>;

    before(async () => {

        loggerStub = sinon.createStubInstance(Logger);
        utilServiceStub = sinon.createStubInstance(UtilService);
        timeUtilServiceStub = sinon.createStubInstance(TimeUtilService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleConverterService,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: TimeUtilService,
                    useValue: timeUtilServiceStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                }
            ]
        }).compile();

        service = module.get<GoogleConverterService>(GoogleConverterService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be converted to createUserRequsetDTO from google oauth2 user profile', () => {
        const timezoneMock = 'Asia/Seoul';
        const oauth2UserProfileMock = testMockUtil.getGoogleOAuth2UserWithToken();

        const createUesrWithOAuth2DTO = service.convertToCreateUserRequestDTO(
            timezoneMock,
            oauth2UserProfileMock
        );

        expect(createUesrWithOAuth2DTO).ok;
        expect(createUesrWithOAuth2DTO.createUserRequestDto).ok;
        expect(createUesrWithOAuth2DTO.createUserRequestDto.email).ok;
        expect(createUesrWithOAuth2DTO.oauth2UserProfile).ok;
    });

    it('should be converted to GoogleCalendarIntegration from GoogleCalendar', () => {
        const googleCalendarListMock = testMockUtil.getGoogleCalendarMock();

        const googleCalendarList =
            service.convertToGoogleCalendarIntegration(googleCalendarListMock, {
                filterGoogleGroupCalendars: false
            });

        expect(googleCalendarList).ok;
        expect(googleCalendarList.length).greaterThan(0);

        const [converted] = googleCalendarList;
        expect(converted).ok;
        expect(converted.primary).ok;
    });

    it('should be converted to GoogleCalendarIntegration from GoogleCalendar without google group calendar', () => {
        const googleCalendarListMock = testMockUtil.getGoogleCalendarMock();

        const calendarCount = googleCalendarListMock.items && googleCalendarListMock.items.length || 0;

        // googleGroupCalendarMock
        googleCalendarListMock.items?.push({
            id: 'addressbook#contacts@group.v.calendar.google.com'
        });

        const googleCalendarList =
            service.convertToGoogleCalendarIntegration(googleCalendarListMock);

        expect(googleCalendarList).ok;
        expect(googleCalendarList.length).equals(calendarCount);

        const [converted] = googleCalendarList;
        expect(converted).ok;
        expect(converted.primary).ok;
    });

    describe('Test converting', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();

            utilServiceStub.generateUUID.reset();
        });

        it('should be refused invalid google schedules', () => {

            const recurrenceGoogleScheduleCount = 1;
            const normalGoogleScheduleCount = 1;

            const expectedConvertedScheduleCount = recurrenceGoogleScheduleCount + normalGoogleScheduleCount;

            const convertGoogleScheduleToDateTimesStub = serviceSandbox.stub(service, 'convertGoogleScheduleToDateTimes');
            convertGoogleScheduleToDateTimesStub.returns({
                startDatetime: new Date(),
                endDatetime: new Date()
            });
            const convertRRuleGoogleEventToGoogleIntegrationSchedulesStub = serviceSandbox.stub(service, 'convertRRuleGoogleEventToGoogleIntegrationSchedules');
            const convertGoogleScheduleToGoogleIntegrationScheduleStub = serviceSandbox.stub(service, '_convertGoogleScheduleToGoogleIntegrationSchedule');

            const googleCalendarScheduledEventBodyMock = testMockUtil.getGoogleCalendarScheduledEventBodyMock();

            const converted = service.convertToGoogleIntegrationSchedules(googleCalendarScheduledEventBodyMock);
            expect(converted).ok;
            expect(converted.length).equals(expectedConvertedScheduleCount);

            expect(convertGoogleScheduleToDateTimesStub.called).true;
            expect(convertRRuleGoogleEventToGoogleIntegrationSchedulesStub.called).true;
            expect(convertGoogleScheduleToGoogleIntegrationScheduleStub.called).true;
        });

        it('should be converted date from rrule', () => {

            const recurrenceRulesString = 'RRULE:FREQ=YEARLY';
            const startDate = new Date(2022, 8, 15, 0, 0, 0);

            const endDate = new Date(2023, 8, 16, 0, 0, 0);
            const diffTimestamp = startDate.getTime() - endDate.getTime();

            const maxDate = new Date(2024, 11, 16, 0, 0, 0);

            const convertedDates = service.convertRecurrenceRuleToDates(
                recurrenceRulesString,
                startDate,
                maxDate,
                diffTimestamp
            );

            expect(convertedDates).ok;
            expect(convertedDates.length).greaterThan(1);

            expect(convertedDates[0]).ok;
            expect(convertedDates[0].startDatetime.getMonth()).equals(startDate.getMonth());
            expect(convertedDates[0].startDatetime.getDate()).equals(startDate.getDate());

            expect(convertedDates[1]).ok;
            expect(convertedDates[1].startDatetime.getMonth()).equals(startDate.getMonth());
            expect(convertedDates[1].startDatetime.getDate()).equals(startDate.getDate());
        });

        it('should be converted date from rrule for weekly', () => {

            const recurrenceRulesString = 'RRULE:FREQ=WEEKLY;WKST=SU;COUNT=5;BYDAY=TU';

            const startDate = new Date('2023-07-18T01:00:00.000Z');
            const maxDate = new Date('2023-10-09T10:41:40.762Z');
            // 1800000 = 30min
            const diffTimestamp = 1800000;

            const convertedDates = service.convertRecurrenceRuleToDates(
                recurrenceRulesString,
                startDate,
                maxDate,
                diffTimestamp
            );

            expect(convertedDates).ok;
            expect(convertedDates.length).greaterThan(1);

            expect(convertedDates[0]).ok;
            expect(convertedDates[0].startDatetime.getMonth()).equals(startDate.getMonth());

            expect(convertedDates[1].startDatetime.getTime()).greaterThan(convertedDates[0].startDatetime.getTime());
            expect(convertedDates[1].endDatetime.getTime()).greaterThan(convertedDates[0].endDatetime.getTime());
            expect(convertedDates[1]).ok;
        });

        it('should be converted date from rrule including period start', () => {

            const recurrenceRulesString = 'RRULE:FREQ=YEARLY';

            const startDate = new Date('2023-09-15 00:00:00.000');
            const maxDate = new Date('2023-10-09T10:41:40.762Z');
            // 1800000 = 30min
            const diffTimestamp = 1800000;

            const convertedDates = service.convertRecurrenceRuleToDates(
                recurrenceRulesString,
                startDate,
                maxDate,
                diffTimestamp
            );

            expect(convertedDates).ok;
            expect(convertedDates.length).greaterThan(0);
        });

        [
            {
                description: 'should be converted to google calendar event from sync scheduled event',
                hostTimezoneMock: stubOne(UserSetting).preferredTimezone,
                googleCalendarIntegrationEmailMock: stubOne(GoogleCalendarIntegration).name,
                scheduledEventMock: stubOne(ScheduledEvent, {
                    scheduledTime: stubOne(ScheduledTimeset),
                    scheduledNotificationInfo: {
                        invitee: [
                            {
                                type: NotificationType.EMAIL,
                                reminders: [ { typeValue: 'alan@sync.day' } ]
                            }
                        ]
                    },
                    inviteeAnswers: [
                        {
                            priority: 1,
                            type:  QuestionType.TEXT,
                            required: true
                        }
                    ],
                    invitees: [
                        {
                            name: 'alan',
                            email: 'alan@sync.day',
                            locale: 'ko-KR',
                            phoneNumber: '',
                            timezone: 'Asia/Seoul'
                        }
                    ],
                    hostProfiles: [
                        {
                            ...stubOne(Profile),
                            ...stubOne(User)
                        } as unknown as HostProfile
                    ],
                    host: stubOne(Host),
                    contacts: [
                        {
                            type: ContactType.GOOGLE_MEET,
                            value: 'in company'
                        }
                    ],
                    conferenceLinks: [{ type: IntegrationVendor.GOOGLE, link: 'https://video.sync.day', serviceName: 'Syncday Living Streaming Service' }]
                }),
                expectedPropertyConvertedGoogleScheduleContain: 'conferenceData',
                expectedPropertyConvertedGoogleScheduleNotContain: 'location'
            },
            {
                description: 'should be converted to google calendar event from sync scheduled event when event detail descript is null',
                hostTimezoneMock: stubOne(UserSetting).preferredTimezone,
                googleCalendarIntegrationEmailMock: stubOne(GoogleCalendarIntegration).name,
                scheduledEventMock: stubOne(ScheduledEvent, {
                    scheduledTime: stubOne(ScheduledTimeset),
                    scheduledNotificationInfo: {
                        invitee: [
                            {
                                type: NotificationType.EMAIL,
                                reminders: [ { typeValue: 'alan@sync.day' } ]
                            }
                        ]
                    },
                    hostProfiles: [
                        {
                            ...stubOne(Profile),
                            ...stubOne(User)
                        } as unknown as HostProfile
                    ],
                    inviteeAnswers: [
                        {
                            priority: 1,
                            type:  QuestionType.TEXT,
                            required: true
                        }
                    ],
                    invitees: [
                        {
                            name: 'alan',
                            email: 'alan@sync.day',
                            locale: 'ko-KR',
                            phoneNumber: '',
                            timezone: 'Asia/Seoul'
                        }
                    ],
                    host: stubOne(Host),
                    contacts: [
                        {
                            type: ContactType.GOOGLE_MEET,
                            value: 'in company'
                        }
                    ],
                    conferenceLinks: [{ type: IntegrationVendor.GOOGLE, link: 'https://video.sync.day', serviceName: 'Syncday Living Streaming Service' }]
                }),
                expectedPropertyConvertedGoogleScheduleContain: 'conferenceData',
                expectedPropertyConvertedGoogleScheduleNotContain: 'location'
            },
            {
                description: 'should be converted to google calendar event from sync scheduled event with conference link when event contact is zoom link',
                hostTimezoneMock: stubOne(UserSetting).preferredTimezone,
                googleCalendarIntegrationEmailMock: stubOne(GoogleCalendarIntegration).name,
                scheduledEventMock: stubOne(ScheduledEvent, {
                    scheduledTime: stubOne(ScheduledTimeset),
                    scheduledNotificationInfo: {
                        invitee: [
                            {
                                type: NotificationType.EMAIL,
                                reminders: [ { typeValue: 'alan@sync.day' } ]
                            }
                        ]
                    },
                    hostProfiles: [
                        {
                            ...stubOne(Profile),
                            ...stubOne(User)
                        } as unknown as HostProfile
                    ],
                    inviteeAnswers: [
                        {
                            priority: 1,
                            type:  QuestionType.TEXT,
                            required: true
                        }
                    ],
                    invitees: [
                        {
                            name: 'alan',
                            email: 'alan@sync.day',
                            locale: 'ko-KR',
                            phoneNumber: '',
                            timezone: 'Asia/Seoul'
                        }
                    ],
                    host: stubOne(Host),
                    contacts: [
                        {
                            type: ContactType.ZOOM,
                            value: 'in company'
                        }
                    ],
                    conferenceLinks: [{ type: IntegrationVendor.ZOOM, link: 'https://video.sync.day', serviceName: 'Syncday Living Streaming Service' }]
                }),
                expectedPropertyConvertedGoogleScheduleContain: 'location',
                expectedPropertyConvertedGoogleScheduleNotContain: 'conferenceData'
            },
            {
                description: 'should be converted to google calendar event from sync scheduled event without conference link when event contact is not link method',
                hostTimezoneMock: stubOne(UserSetting).preferredTimezone,
                googleCalendarIntegrationEmailMock: stubOne(GoogleCalendarIntegration).name,
                scheduledEventMock: stubOne(ScheduledEvent, {
                    scheduledTime: stubOne(ScheduledTimeset),
                    scheduledNotificationInfo: {
                        invitee: [
                            {
                                type: NotificationType.EMAIL,
                                reminders: [ { typeValue: 'alan@sync.day' } ]
                            }
                        ]
                    },
                    hostProfiles: [
                        {
                            ...stubOne(Profile),
                            ...stubOne(User)
                        } as unknown as HostProfile
                    ],
                    inviteeAnswers: [
                        {
                            priority: 1,
                            type:  QuestionType.TEXT,
                            required: true
                        }
                    ],
                    invitees: [
                        {
                            name: 'alan',
                            email: 'alan@sync.day',
                            locale: 'ko-KR',
                            phoneNumber: '',
                            timezone: 'Asia/Seoul'
                        }
                    ],
                    host: stubOne(Host),
                    contacts: [
                        {
                            type: ContactType.IN_PERSON,
                            value: 'in company'
                        }
                    ],
                    conferenceLinks: []
                }),
                expectedPropertyConvertedGoogleScheduleContain: 'location',
                expectedPropertyConvertedGoogleScheduleNotContain: 'conferenceData'
            }
        ].forEach(function ({
            description,
            hostTimezoneMock,
            googleCalendarIntegrationEmailMock,
            scheduledEventMock,
            expectedPropertyConvertedGoogleScheduleContain,
            expectedPropertyConvertedGoogleScheduleNotContain
        }) {
            it(description, () => {
                const convertedGoogleSchedule = service.convertScheduledEventToGoogleCalendarEvent(
                    hostTimezoneMock,
                    googleCalendarIntegrationEmailMock,
                    scheduledEventMock
                );

                const {
                    start: convertedStartDatetimeString,
                    end: convertedEndDatetimeString
                } = convertedGoogleSchedule as {
                    start: calendar_v3.Schema$EventDateTime;
                    end: calendar_v3.Schema$EventDateTime;
                };

                const convertedStartDatetime = new Date(convertedStartDatetimeString.dateTime as string);
                const convertedEndDatetime = new Date(convertedEndDatetimeString.dateTime as string);

                expect(convertedGoogleSchedule).ok;
                expect(convertedStartDatetime.getTime()).equals(scheduledEventMock.scheduledTime.startTimestamp.getTime());
                expect(convertedEndDatetime.getTime()).equals(scheduledEventMock.scheduledTime.endTimestamp.getTime());
                expect(convertedGoogleSchedule).ok;

                expect(utilServiceStub.generateUUID.called).true;

                expect(convertedGoogleSchedule).has.property(expectedPropertyConvertedGoogleScheduleContain);
                expect(convertedGoogleSchedule).has.not.property(expectedPropertyConvertedGoogleScheduleNotContain);
            });
        });

        it('should be converted google integration schedules from google scheduled event although google scheduled event has no summary', () => {
            const calendarIdMock = 'alan@sync.day';
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock();
            googleScheduleMock.summary = null;
            const googleIntegrationScheduleStub = stubOne(GoogleIntegrationScheduledEvent, {
                iCalUID: googleScheduleMock.iCalUID as string
            });

            const startDatetime = new Date('2023-09-14T15:00:00.000Z');
            const endDatetime = new Date('2022-09-13T15:00:00.000Z');

            serviceSandbox.stub(service, '_convertGoogleScheduleToGoogleIntegrationSchedule').returns(googleIntegrationScheduleStub);

            const convertedSchedule = service._convertGoogleScheduleToGoogleIntegrationSchedule(
                calendarIdMock,
                googleScheduleMock,
                startDatetime,
                endDatetime
            );

            expect(convertedSchedule).ok;
            expect(convertedSchedule.name).ok;
        });

        it('should be converted google integration schedules from google scheduled event', () => {
            const recurrenceRulesString = 'RRULE:FREQ=YEARLY';
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock(recurrenceRulesString);
            const calendarIdMock = 'alan@sync.day';
            const googleIntegrationScheduleStub = stubOne(GoogleIntegrationScheduledEvent, {
                iCalUID: googleScheduleMock.iCalUID as string
            });

            const convertedDatesStubs = [
                {
                    startDatetime: new Date('2023-09-14T15:00:00.000Z'),
                    endDatetime: new Date('2022-09-13T15:00:00.000Z')
                },
                {
                    startDatetime: new Date('2024-09-14T15:00:00.000Z'),
                    endDatetime: new Date('2023-09-14T15:00:00.000Z')
                }
            ];

            serviceSandbox.stub(service, 'convertRecurrenceRuleToDates').returns(convertedDatesStubs);
            serviceSandbox.stub(service, '_convertGoogleScheduleToGoogleIntegrationSchedule').returns(googleIntegrationScheduleStub);

            const startDate = new Date(2022, 8, 15, 0, 0, 0);
            const endDate = new Date(2023, 8, 16, 0, 0, 0);

            const convertedGoogleIntegrationSchedules = service.convertRRuleGoogleEventToGoogleIntegrationSchedules(
                calendarIdMock,
                googleScheduleMock,
                startDate,
                endDate
            );
            expect(convertedGoogleIntegrationSchedules).ok;
            expect(convertedGoogleIntegrationSchedules.length).greaterThan(0);

            const convertedGoogleIntegrationSchedule = convertedGoogleIntegrationSchedules[0];
            expect(convertedGoogleIntegrationSchedule).ok;
            expect(convertedGoogleIntegrationSchedule.iCalUID).ok;
        });

        it('should be converted google integration scheduled event with source date time', () => {
            const recurrenceRulesString = 'RRULE:FREQ=DAILY';
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock(recurrenceRulesString);
            const calendarIdMock = 'alan@sync.day';

            const convertedDatesStubs = [
                {
                    startDatetime: new Date('2023-07-18T00:00:00+09:00'),
                    endDatetime: new Date('2023-07-18T00:00:00+09:00')
                }
            ];
            const googleIntegrationScheduleStub = stubOne(GoogleIntegrationScheduledEvent, {
                iCalUID: googleScheduleMock.iCalUID as string,
                scheduledTime: {
                    startTimestamp: convertedDatesStubs[0].startDatetime,
                    endTimestamp: convertedDatesStubs[0].endDatetime
                }
            });

            const convertRecurrenceRuleToDatesStub = serviceSandbox.stub(service, 'convertRecurrenceRuleToDates');

            convertRecurrenceRuleToDatesStub.returns(convertedDatesStubs);
            serviceSandbox.stub(service, '_convertGoogleScheduleToGoogleIntegrationSchedule').returns(googleIntegrationScheduleStub);

            const startDate = new Date('2023-07-18T12:30:00+09:00');
            const endDate = new Date('2023-07-18T13:00:00+09:00');

            const convertedGoogleIntegrationSchedules = service.convertRRuleGoogleEventToGoogleIntegrationSchedules(
                calendarIdMock,
                googleScheduleMock,
                startDate,
                endDate
            );
            expect(convertedGoogleIntegrationSchedules).ok;
            expect(convertedGoogleIntegrationSchedules.length).greaterThan(0);

            const convertedGoogleIntegrationSchedule = convertedGoogleIntegrationSchedules[0];
            expect(convertedGoogleIntegrationSchedule).ok;
            expect(convertedGoogleIntegrationSchedule.iCalUID).ok;

            const passedMinDate = convertRecurrenceRuleToDatesStub.args[0][1];
            expect(passedMinDate.getHours()).equals(startDate.getHours());
            expect(passedMinDate.getMinutes()).equals(startDate.getMinutes());
        });
    });

});
