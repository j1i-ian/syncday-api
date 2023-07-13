import { Test, TestingModule } from '@nestjs/testing';
import { calendar_v3 } from 'googleapis';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { UtilService } from '@services/util/util.service';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { ScheduledTimeset } from '@entity/schedules/scheduled-timeset.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleConverterService } from './google-converter.service';

const testMockUtil = new TestMockUtil();

describe('GoogleConverterService', () => {
    let service: GoogleConverterService;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    before(async () => {

        utilServiceStub = sinon.createStubInstance(UtilService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleConverterService,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                }
            ]
        }).compile();

        service = module.get<GoogleConverterService>(GoogleConverterService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be converted to GoogleCalendarIntegration from GoogleCalendar', () => {
        const googleCalendarListMock = testMockUtil.getGoogleCalendarMock();

        const googleCalendarList =
            service.convertToGoogleCalendarIntegration(googleCalendarListMock);

        expect(googleCalendarList).ok;
        expect(googleCalendarList.length).greaterThan(0);

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

        it('should be converted to google calendar event from sync scheduled event', () => {
            const hostTimezoneMock = stubOne(UserSetting).preferredTimezone;
            const scheduledTimeMock = stubOne(ScheduledTimeset);
            const scheduleMock = stubOne(Schedule, {
                scheduledTime: scheduledTimeMock,
                scheduledNotificationInfo: {
                    invitee: [
                        {
                            type: NotificationType.EMAIL,
                            reminders: [ { typeValue: 'alan@sync.day' } ]
                        }
                    ]
                },
                conferenceLinks: [{ type: IntegrationVendor.GOOGLE, link: 'https://video.sync.day', serviceName: 'Syncday Living Streaming Service' }]
            });

            const convertedGoogleSchedule = service.convertScheduledEventToGoogleCalendarEvent(
                hostTimezoneMock,
                scheduleMock
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
            expect(convertedStartDatetime.getTime()).equals(scheduleMock.scheduledTime.startTimestamp.getTime());
            expect(convertedEndDatetime.getTime()).equals(scheduleMock.scheduledTime.startTimestamp.getTime());
            expect(convertedGoogleSchedule).ok;

            expect(utilServiceStub.generateUUID.called).true;
        });

        it('should be converted google integration schedules from google schedule although google schedule has no summary', () => {
            const calendarIdMock = 'alan@sync.day';
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock();
            googleScheduleMock.summary = null;
            const googleIntegrationScheduleStub = stubOne(GoogleIntegrationSchedule, {
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

        it('should be converted google integration schedules from google schedule', () => {
            const recurrenceRulesString = 'RRULE:FREQ=YEARLY';
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock(recurrenceRulesString);
            const calendarIdMock = 'alan@sync.day';
            const googleIntegrationScheduleStub = stubOne(GoogleIntegrationSchedule, {
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
    });

});
