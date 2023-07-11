import { Test, TestingModule } from '@nestjs/testing';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleConverterService } from './google-converter.service';

const testMockUtil = new TestMockUtil();

describe('GoogleConverterService', () => {
    let service: GoogleConverterService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleConverterService]
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

        it('should be converted google integration schedules from google schedule although google schedule has no summary', () => {
            const calendarIdMock = 'alan@sync.day';
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock();
            googleScheduleMock.summary = null;
            const googleIntegrationScheduleStub = stubOne(GoogleIntegrationSchedule, {
                iCalUID: googleScheduleMock.iCalUID as string
            });

            serviceSandbox.stub(service, '_convertGoogleScheduleToGoogleIntegrationSchedule').returns(googleIntegrationScheduleStub);

            const convertedSchedule = service.convertToGoogleIntegrationSchedule(
                calendarIdMock,
                googleScheduleMock
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
