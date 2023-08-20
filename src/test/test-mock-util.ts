/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/unified-signatures */
import 'reflect-metadata';

import { SinonSandbox } from 'sinon';

import { ArgumentsHost } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Auth, calendar_v3 } from 'googleapis';
import { TemporaryUser } from '@core/entities/users/temporary-user.entity';
import { Availability } from '@core/entities/availability/availability.entity';
import { InviteeQuestion } from '@core/entities/invitee-questions/invitee-question.entity';
import { QuestionInputType } from '@core/entities/invitee-questions/question-input-type.enum';
import { GoogleCalendarAccessRole } from '@interfaces/integrations/google/google-calendar-access-role.enum';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { Notification } from '@interfaces/notifications/notification';
import { Reminder } from '@interfaces/reminders/reminder';
import { ReminderType } from '@interfaces/reminders/reminder-type.enum';
import { EventSetting } from '@interfaces/events/event-setting';
import { Schedule } from '@entity/schedules/schedule.entity';
import { Weekday } from '@entity/availability/weekday.enum';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { Verification } from '@entity/verifications/verification.interface';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { ScheduleBody } from '@app/interfaces/schedules/schedule-body.interface';
import { GoogleIntegrationBody } from '@app/interfaces/integrations/google/google-integration-body.interface';
import { GoogleCalendarScheduleBody } from '@app/interfaces/integrations/google/google-calendar-schedule-body.interface';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';
import { GoogleCalendarEvent } from '@app/interfaces/integrations/google/google-calendar-event.interface';
import { Faker, faker } from '@faker-js/faker';
import { DataSourceMock } from '@test/datasource-mock.interface';
import { Language } from '../main/enums/language.enum';

export class TestMockUtil {
    static _instance: TestMockUtil;

    static getTypeormUpdateResultMock(affectedNumber = 1): UpdateResult {
        return { affected: affectedNumber } as UpdateResult;
    }

    static getDataSourceMock(getNestTestingModuleCallback: () => TestingModule): DataSourceMock {
        const _getRepository = (EntityClass: new () => any) =>
            getNestTestingModuleCallback().get(getRepositoryToken(EntityClass));

        const datasourceMock = {
            getRepository: _getRepository,
            transaction: (callback: any) =>
                Promise.resolve(callback({ getRepository: _getRepository }))
        };

        return datasourceMock;
    }

    static get faker(): Faker {
        return faker;
    }

    constructor() {
        if (!TestMockUtil._instance) {
            TestMockUtil._instance = this;
            faker.locale = 'ko';
        }

        return TestMockUtil._instance;
    }

    sandbox: SinonSandbox;

    getVerificationMock(): Verification {
        const emailMock = faker.internet.email('foo', 'bar');

        return {
            email: emailMock,
            verificationCode: '1423'
        } as Verification;
    }

    getGoogleScheduleMock(recurrenceRulesString = 'RRULE:FREQ=YEARLY'): GoogleCalendarEvent {
        const defaultGoogleScheduleMock: GoogleCalendarEvent = JSON.parse('{"kind":"calendar#event","etag":"\\"3263178453827000\\"","id":"_74q34c1o61336b9g60rj6b9k6ss44ba26ssj6b9l6h0k6h9p6534ae2174","status":"confirmed","htmlLink":"https://www.google.com/calendar/event?eid=Xzc0cTM0YzFvNjEzMzZiOWc2MHJqNmI5azZzczQ0YmEyNnNzajZiOWw2aDBrNmg5cDY1MzRhZTIxNzRfMjAxOTA5MTUgNHRoc3RvbkBt","created":"2021-09-07T18:14:35.000Z","updated":"2021-09-14T03:13:46.943Z","summary":"친구 생일","creator":{"email":"alan@gmail.com","self":true},"organizer":{"email":"alan@gmail.com","self":true},"start":{"date":"2019-09-15"},"end":{"date":"2019-09-16"},"iCalUID":"942080F3-0073-478B-B793-54ACE91FE8A9","sequence":0,"reminders":{"useDefault":false},"eventType":"default"}');

        defaultGoogleScheduleMock.recurrence = recurrenceRulesString ? [recurrenceRulesString] : [];
        defaultGoogleScheduleMock.conferenceData = {
            entryPoints: [ {uri: 'sampleGoogleMeetLink'} ]
        };
        defaultGoogleScheduleMock.timezone = 'Asia/Seoul';

        return defaultGoogleScheduleMock;
    }

    getBearerTokenMock(): string {
        // eslint-disable-next-line max-len
        return 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImppaGFuLmxlZTIiLCJzdWIiOiJqaWhhbi5sZWUyK0UwMTY3OEY3LTI4NUYtNDQ4MC1BMDA2LUIzOUY1NjJBMThBOSIsImlhdCI6MTY1MTE5OTAxMSwiZXhwIjoxNjUxODAzODExfQ.umhNz65cHTMgC_05gxqTqWVdSmxZYQviV3Lb_Mw9P34';
    }

    getAvailabilityBodyRecordMocks(
        availabilityStubs?: Array<Pick<Availability, 'uuid' | 'availableTimes' | 'overrides'>>
    ): Record<string, AvailabilityBody> {
        if (!availabilityStubs) {
            availabilityStubs = stub(Availability);
        }

        return Object.fromEntries(
            availabilityStubs.map(
                (availabilityStub: Pick<Availability, 'uuid' | 'availableTimes' | 'overrides'>) => {
                    const { availableTimes: _availableTimes, overrides: _overrides } =
                        availabilityStub;
                    const _availabilityBody: AvailabilityBody =
                        _availableTimes && _overrides
                            ? ({
                                availableTimes: _availableTimes,
                                overrides: _overrides
                            } as AvailabilityBody)
                            : ({
                                availableTimes: [],
                                overrides: []
                            } as AvailabilityBody);

                    return [
                        availabilityStub.uuid,
                        {
                            availableTimes: _availabilityBody.availableTimes,
                            overrides: _availabilityBody.overrides
                        } as AvailabilityBody
                    ];
                }
            )
        ) as Record<string, AvailabilityBody>;
    }

    getScheduleTimeMock(date?: Date): Pick<Schedule, 'scheduledTime' | 'scheduledBufferTime'> {

        const now = new Date(date ?? Date.now());
        const _1hourAfter = new Date();
        _1hourAfter.setHours(_1hourAfter.getHours() + 1);

        return {
            scheduledTime: {
                startTimestamp: now,
                endTimestamp: _1hourAfter
            },
            scheduledBufferTime: {
                startBufferTimestamp: null,
                endBufferTimestamp: null
            }
        };
    }

    getScheduleBodyMock(): ScheduleBody {

        return {
            inviteeAnswers: [],
            scheduledNotificationInfo: {
                host: {},
                invitee: {}
            } as NotificationInfo
        } as ScheduleBody;
    }

    getAvailabilityBodyMock(availability?: Availability): AvailabilityBody {
        if (!availability) {
            availability = stubOne(Availability);
        }

        return {
            availableTimes: [ { day: Weekday.SUNDAY, timeRanges: [ { startTime: '09:00:00', endTime: '21:00:00' } ] } ],
            overrides: []
        } as AvailabilityBody;
    }

    getInviteeQuestionMock(
        eventDetailUUID?: string,
        inviteeQuestion?: Partial<InviteeQuestion>
    ): InviteeQuestion {
        return {
            eventDetailUUID: eventDetailUUID || 'DEFAULT_EVENT_DETAIL_UUID',
            name: faker.name.jobTitle(),
            inputType: QuestionInputType.TEXT,
            required: false,
            ...inviteeQuestion
        };
    }

    getNotificationInfoMock(): NotificationInfo {

        const hostNotificationMock = this.getNotificationMock();
        const inviteeNotificationMock = this.getNotificationMock();

        return {
            host: [hostNotificationMock],
            invitee: [inviteeNotificationMock]
        };
    }

    getNotificationMock(): Notification {

        const reminderMock = this.getReminderMock();

        return {
            reminders: [reminderMock],
            type: NotificationType.EMAIL,
            uuid: faker.datatype.uuid()
        };
    }

    getEventSettingMock(): EventSetting {

        return {
            enforceInviteePhoneInput: false
        };
    }

    getReminderMock(reminder?: Partial<Reminder>): Reminder {
        return {
            remindBefore: '10',
            type: ReminderType.SMS,
            uuid: faker.datatype.uuid(),
            ...reminder
        };
    }

    getGoogleOAuthClientMock(): Auth.OAuth2Client {
        return {} as Auth.OAuth2Client;
    }

    getGoogleOAuthTokenMock(): OAuthToken {
        const googleIntegrationMock = stubOne(GoogleIntegration);

        return {
            accessToken: googleIntegrationMock.accessToken,
            refreshToken: googleIntegrationMock.refreshToken
        };
    }

    getGoogleCalendarMock(): calendar_v3.Schema$CalendarList {
        return {
            nextSyncToken: faker.datatype.uuid(),
            items: [
                {
                    id: 'c_635f19c3e80fc57e57700c3f71b1a96f81ef0af3c5264e9a966fe1f5dc3874fa@group.calendar.google.com',
                    accessRole: GoogleCalendarAccessRole.OWNER,
                    primary: true,
                    description: 'testDescription'
                }
            ]
        };
    }

    getGoogleIntegrationBodyMock(): GoogleIntegrationBody {

        const email = 'private_google_email@sync.day';
        const calendarsMock = this.getGoogleCalendarMock();
        const googleCalendarScheduleBody = this.getGoogleCalendarScheduleBodyMock();

        return {
            googleUserEmail: email,
            calendars: calendarsMock,
            schedules: googleCalendarScheduleBody
        };
    }

    getGoogleCalendarScheduleBodyMock(): GoogleCalendarScheduleBody {

        const cancelledGoogleScheduleMock = this.getCancelledGoogleScheduleMock();
        const recurrenceGoogleScheduleMock = this.getRecurrenceGoogleScheduleMock();
        const googleScheduleMock = this.getGoogleScheduleMock('');

        return {
            'primary': [ cancelledGoogleScheduleMock, recurrenceGoogleScheduleMock, googleScheduleMock ]
        };
    }

    getRecurrenceGoogleScheduleMock(): GoogleCalendarEvent {

        const rrule = 'RRULE:FREQ=WEEKLY;WKST=SU;COUNT=5;BYDAY=TU';

        return {
            recurrence: [rrule],
            id: '5vqgu90q66itlhsdiopn13ine6_20230717T013000Z',
            kind: 'calendar#event',
            status: 'cancelled',
            timezone: 'Asia/Seoul'
        };
    }

    getCancelledGoogleScheduleMock(): GoogleCalendarEvent {
        return {
            etag: '"337672944432000"',
            id: '4vqgu90q66itlhsdiopn13ine6_20230717T013000Z',
            kind: 'calendar#event',
            originalStartTime: { dateTime: '2023-07-17T10:30:00+09:00' },
            recurringEventId: '4vqgu90q66itlhsdiopn13ine6_R20230501T0130',
            status: 'cancelled',
            timezone: 'Asia/Seoul'
        };
    }

    /**
     * filter test 에 쓰인다.
     */
    getArgumentHostMock(callback: (_body: unknown) => void): ArgumentsHost;
    getArgumentHostMock(
        getRequestValue: unknown,
        callback: (_body: unknown) => void
    ): ArgumentsHost;
    getArgumentHostMock(
        getRequestValue: unknown,
        callback: (_body: unknown) => void,
        sandbox?: sinon.SinonSandbox
    ): ArgumentsHost;
    getArgumentHostMock(
        getRequestValueOrCallback?: unknown,
        callback?: (_body: unknown) => void,
        sandbox?: sinon.SinonSandbox
    ): ArgumentsHost {
        let patchedCallback: Function;
        let getRequestValue: unknown = null;
        if (getRequestValueOrCallback instanceof Function) {
            patchedCallback = getRequestValueOrCallback;
            getRequestValue = null;
        } else {
            patchedCallback = callback as Function;
            getRequestValue = getRequestValueOrCallback;
        }

        const _sandbox = sandbox || this.sandbox;

        // TODO: replace any with unknown and define argument hosts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const argHostMock: ArgumentsHost & any = {
            switchToHttp: _sandbox.stub().returnsThis(),
            getArgByIndex: _sandbox.stub().returnsThis(),
            getRequest: () => getRequestValue,
            getArgs: _sandbox.stub().returnsThis(),
            getType: _sandbox.stub().returnsThis(),
            getHandler: _sandbox.stub().returnsThis(),
            getClass: _sandbox.stub().returnsThis(),
            switchToRpc: _sandbox.stub().returnsThis(),
            switchToWs: _sandbox.stub().returnsThis(),

            getResponse: _sandbox.stub().returnsThis(),
            status: _sandbox.stub().returnsThis(),
            json: (_body: unknown) => {
                patchedCallback(_body);
            }
        };

        return argHostMock;
    }

    getTemporaryUser(): TemporaryUser {
        return {
            email: faker.internet.email(),
            name: faker.name.fullName(),
            plainPassword: faker.word.noun(),
            language: Language.ENGLISH
        };
    }

    getOverridedAvailabilityTimeMock(): OverridedAvailabilityTime {
        return {
            targetDate: new Date('2023-07-17 00:00:00'),
            timeRanges: [
                {
                    startTime: '2023-07-17 09:00:00',
                    endTime: '2023-07-17 17:00:00'
                }
            ]
        };
    }
}
