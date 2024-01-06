/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/unified-signatures */
import 'reflect-metadata';

import { SinonSandbox, SinonStub } from 'sinon';

import { ArgumentsHost } from '@nestjs/common';
import { DeleteResult, UpdateResult } from 'typeorm';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Auth, calendar_v3, oauth2_v2 } from 'googleapis';
import { DAVCalendar, DAVClient, DAVObject } from 'tsdav';
import { Request } from 'express';
import { Logger } from 'winston';
import { TemporaryUser } from '@core/entities/users/temporary-user.entity';
import { Availability } from '@core/entities/availability/availability.entity';
import { InviteeQuestion } from '@core/entities/invitee-questions/invitee-question.entity';
import { QuestionInputType } from '@core/entities/invitee-questions/question-input-type.enum';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { GoogleCalendarEvent } from '@core/interfaces/integrations/google/google-calendar-event.interface';
import { GoogleIntegrationBody } from '@core/interfaces/integrations/google/google-integration-body.interface';
import { GoogleCalendarScheduleBody } from '@core/interfaces/integrations/google/google-calendar-schedule-body.interface';
import { CreatedCalendarEvent } from '@core/interfaces/integrations/created-calendar-event.interface';
import { GoogleOAuth2UserWithToken } from '@core/interfaces/integrations/google/google-oauth2-user-with-token.interface';
import { GoogleCalendarAccessRole } from '@interfaces/integrations/google/google-calendar-access-role.enum';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { Notification } from '@interfaces/notifications/notification';
import { Reminder } from '@interfaces/reminders/reminder';
import { ReminderType } from '@interfaces/reminders/reminder-type.enum';
import { EventSetting } from '@interfaces/events/event-setting';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { InvitedNewTeamMember } from '@services/team/invited-new-team-member.type';
import { Schedule } from '@entity/schedules/schedule.entity';
import { Weekday } from '@entity/availability/weekday.enum';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { Verification } from '@entity/verifications/verification.interface';
import { ConferenceLink } from '@entity/schedules/conference-link.entity';
import { ScheduledTimeset } from '@entity/schedules/scheduled-timeset.entity';
import { User } from '@entity/users/user.entity';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { ScheduleBody } from '@app/interfaces/schedules/schedule-body.interface';
import { SyncdayOAuth2TokenResponse } from '@app/interfaces/auth/syncday-oauth2-token-response.interface';
import { ZoomCreateMeetingResponseDTO } from '@app/interfaces/integrations/zoom/zoom-create-meeting-response.interface';
import { MeetingType } from '@app/interfaces/integrations/zoom/enum/meeting-type.enum';
import { ZoomUserResponseDTO } from '@app/interfaces/integrations/zoom/zoom-user-response.interface';
import { Audio } from '@app/interfaces/integrations/zoom/enum/audio.enum';
import { AutoRecording } from '@app/interfaces/integrations/zoom/enum/auto-recording.enum';
import { EncryptionType } from '@app/interfaces/integrations/zoom/enum/encryption-type.enum';
import { ApprovedOrDeniedCountriesOrRegions } from '@app/interfaces/integrations/zoom/interface/approved-denied-countries-regions.interface';
import { BreakoutRoom } from '@app/interfaces/integrations/zoom/interface/breakout-room.interface';
import { Faker, faker } from '@faker-js/faker';
import { DataSourceMock } from '@test/datasource-mock.interface';
import { Language } from '../main/enums/language.enum';

export class TestMockUtil {
    static _instance: TestMockUtil;

    static getTypeormUpdateResultMock(affectedNumber = 1): UpdateResult {
        return { affected: affectedNumber } as UpdateResult;
    }

    static getTypeormDeleteResultMock(affectedNumber = 1): DeleteResult {
        return { affected: affectedNumber } as DeleteResult;
    }

    static getDataSourceMock(getNestTestingModuleCallback: () => TestingModule): DataSourceMock {
        const _getRepository = (EntityClass: new () => any) =>
            getNestTestingModuleCallback().get(getRepositoryToken(EntityClass));

        const datasourceMock = {
            stub: null,
            getRepository: _getRepository,
            transaction: (callback: any) =>
                Promise.resolve(callback({ getRepository: _getRepository })),
            // eslint-disable-next-line object-shorthand
            setQuery: function (stubValue: any) { this.stub = stubValue; },
            // eslint-disable-next-line object-shorthand
            query: function() { return Promise.resolve(this.stub); }
        };

        return datasourceMock;
    }

    static getLoggerStub(): SinonStub {

        const loggerStub = sinon.stub({
            debug: () => {},
            info: () => {},
            error: () => {}
        } as unknown as Logger) as unknown as SinonStub;

        return loggerStub;
    }

    static get faker(): Faker {
        return faker;
    }

    constructor(locale = 'ko') {
        if (!TestMockUtil._instance) {
            TestMockUtil._instance = this;
            faker.locale = locale;
        }

        return TestMockUtil._instance;
    }

    sandbox: SinonSandbox;

    getInvitedNewTeamMemberMocks(teamIdMock: number): InvitedNewTeamMember[] {
        return stub(User, 10, {
            phone: TestMockUtil.faker.phone.number()
        }).map((_user, index) => index % 2 ? {
            email: _user.email,
            teamId: teamIdMock
        } : {
            phone: _user.phone,
            teamId: teamIdMock
        } as InvitedNewTeamMember);
    }

    getAppleCalDAVCredentialMock(): AppleCalDAVCredential {

        const appleCredentialMock: AppleCalDAVCredential = {
            username: 'fake-user-name',
            password: 'fake-app-specific-password'
        };

        return appleCredentialMock;
    }

    getCalDavClientMock(fakeUserEmail = 'alan@sync.day', {
        calendars,
        calendarObjects
    } = {
        calendars: [],
        calendarObjects: []
    } as {
        calendars: DAVCalendar[];
        calendarObjects: DAVObject[];
    }): DAVClient {
        return {
            fetchCalendars: () => calendars,
            fetchCalendarObjects: () => calendarObjects,
            credentials: {
                username: fakeUserEmail
            }
        } as any;
    }

    getCalDavObjectMocks(): DAVObject[] {
        return [
            {
                url: 'https://caldav.icloud.com/1452332614/calendars/5BA94AC2-8277-4C55-9CE4-712339723BCF/18931BE2-FBB9-4D65-9BC0-2C401E3B9870.ics',
                etag: '"ln9ydv5i"',
                data: 'BEGIN:VCALENDAR\r\n' +
                  'BEGIN:VEVENT\r\n' +
                  'CREATED:20231003T064307Z\r\n' +
                  'DTEND;TZID=Asia/Seoul:20231113T160000\r\n' +
                  'DTSTAMP:20231003T065032Z\r\n' +
                  'DTSTART;TZID=Asia/Seoul:20231113T150000\r\n' +
                  'LAST-MODIFIED:20231003T065031Z\r\n' +
                  'SEQUENCE:0\r\n' +
                  'SUMMARY:이삿날\r\n' +
                  'UID:18931BE2-FBB9-4D65-9BC0-2C401E3B9870\r\n' +
                  'TRANSP:OPAQUE\r\n' +
                  'END:VEVENT\r\n' +
                  'END:VCALENDAR'
            },
            {
                url: 'https://caldav.icloud.com/1452332614/calendars/5BA94AC2-8277-4C55-9CE4-712339723BCF/DBA9D3C4-0DB6-4A13-855F-48C32CAE2C3F.ics',
                etag: '"llyqw26z"',
                data: 'BEGIN:VCALENDAR\r\n' +
                  'BEGIN:VEVENT\r\n' +
                  'CREATED:20230831T054809Z\r\n' +
                  'DTEND;TZID=Asia/Seoul:20231123T150000\r\n' +
                  'DTSTAMP:20230831T054810Z\r\n' +
                  'DTSTART;TZID=Asia/Seoul:20231123T140000\r\n' +
                  'LAST-MODIFIED:20230831T054809Z\r\n' +
                  'SEQUENCE:0\r\n' +
                  'SUMMARY:병원가기\r\n' +
                  'UID:DBA9D3C4-0DB6-4A13-855F-48C32CAE2C3F\r\n' +
                  'TRANSP:OPAQUE\r\n' +
                  'END:VEVENT\r\n' +
                  'END:VCALENDAR'
            },
            {
                url: 'https://caldav.icloud.com/1452332614/calendars/171B3ADA-C372-41FD-AC3E-A1CE442FF8BA/3AE32725-18D0-4A6D-B178-34E5E355FEE8.ics',
                etag: '"lnbuozw4"',
                data: 'BEGIN:VCALENDAR\r\n' +
                  'BEGIN:VEVENT\r\n' +
                  'CREATED:20231004T143513Z\r\n' +
                  'UID:3AE32725-18D0-4A6D-B178-34E5E355FEE8\r\n' +
                  'DTEND;TZID=Asia/Seoul:20231028T100000\r\n' +
                  'SUMMARY:아는 동생과 점심\r\n' +
                  'LAST-MODIFIED:20231004T143649Z\r\n' +
                  'DTSTAMP:20231004T143521Z\r\n' +
                  'DTSTART;TZID=Asia/Seoul:20231028T090000\r\n' +
                  'SEQUENCE:1\r\n' +
                  'TRANSP:OPAQUE\r\n' +
                  'X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC\r\n' +
                  'END:VEVENT\r\n' +
                  'END:VCALENDAR'
            }
        ];
    }

    getCalDavCalendarMocks(): Array<DAVCalendar & { calendarColor: string }> {
        return [
            {
                description: '',
                timezone: '',
                url: 'https://caldav.icloud.com/1452332614/calendars/171C3ADA-C372-41FD-AC3E-A1CE442FF8BA/',
                ctag: 'HwoQEgwAAD4zQGHQvwAAAAEYAhgAIhYIi5LV1Pfti5L3ARCD6Omr0ZTCio0BKAA=',
                calendarColor: '#1BADF8FF',
                displayName: 'Calendar',
                components: [ 'VEVENT' ],
                resourcetype: [ 'collection', 'calendar' ],
                syncToken: 'HwoQEgwAAD4zQGHQvwAAAAEYAhgAIhYIi5LV1Pfti5L3ARCD6Omr0ZTCio0BKAA=',
                projectedProps: {},
                reports: [
                    'aclPrincipalPropSet',
                    'principalMatch',
                    'principalPropertySearch',
                    'syncCollection',
                    'calendarQuery',
                    'calendarMultiget',
                    'freeBusyQuery',
                    'calendarSearch'
                ]
            },
            {
                description: '',
                timezone: '',
                url: 'https://caldav.icloud.com/1452332614/calendars/7BA94AC2-8277-4C55-9CE4-712339723BCF/',
                ctag: 'HwoQEgwAAED1GcqmPgAAAAEYAhgAIhUIpJOdyNLvs4ZgEISY6YSs3OWgjQEoAA==',
                calendarColor: '#0E61B9FF',
                displayName: '생일',
                components: [ 'VEVENT' ],
                resourcetype: [ 'collection', 'calendar' ],
                syncToken: 'HwoQEgwAAED1GcqmPgAAAAEYAhgAIhUIpJOdyNLvs4ZgEISY6YSs3OWgjQEoAA==',
                projectedProps: {},
                reports: [
                    'aclPrincipalPropSet',
                    'principalMatch',
                    'principalPropertySearch',
                    'syncCollection',
                    'calendarQuery',
                    'calendarMultiget',
                    'freeBusyQuery',
                    'calendarSearch'
                ]
            },
            {
                description: '',
                timezone: '',
                url: 'https://caldav.icloud.com/1452332614/calendars/7CDB907D-B40F-410A-A266-53A19F702918/',
                ctag: 'HwoQEgwAAEaL0w2yogAAAAAYARgAIhYI94mFu5L47YqbARDY06uy18ugj4UBKAA=',
                calendarColor: '#FF2968FF',
                displayName: '오늘의 목표',
                components: [ 'VTODO' ],
                resourcetype: [ 'collection', 'calendar' ],
                syncToken: 'HwoQEgwAAEaL0w2yogAAAAAYARgAIhYI94mFu5L47YqbARDY06uy18ugj4UBKAA=',
                projectedProps: {},
                reports: [
                    'aclPrincipalPropSet',
                    'principalMatch',
                    'principalPropertySearch',
                    'syncCollection',
                    'calendarQuery',
                    'calendarMultiget',
                    'freeBusyQuery',
                    'calendarSearch'
                ]
            },
            {
                description: '',
                timezone: '',
                url: 'https://caldav.icloud.com/1452332614/calendars/d049fe64-016a-4a34-a1cf-b428a9e2496f/',
                ctag: 'HwoQEgwAAECKQ1KnAAAAAAEYARgAIhUIsIf9yoKCuPI2EPWmiOWvuLfojgEoAA==',
                calendarColor: '#E6C800FF',
                displayName: '가족',
                components: [ 'VEVENT' ],
                resourcetype: [ 'collection', 'calendar' ],
                syncToken: 'HwoQEgwAAECKQ1KnAAAAAAEYARgAIhUIsIf9yoKCuPI2EPWmiOWvuLfojgEoAA==',
                projectedProps: {},
                reports: [
                    'aclPrincipalPropSet',
                    'principalMatch',
                    'principalPropertySearch',
                    'syncCollection',
                    'calendarQuery',
                    'calendarMultiget',
                    'freeBusyQuery',
                    'calendarSearch'
                ]
            },
            {
                description: '',
                timezone: '',
                url: 'https://caldav.icloud.com/1452332614/calendars/home/',
                ctag: 'HwoQEgwAAECznNlRjQAAAAEYAhgAIhYI14Gx+aCqosLsARDosZjX8YLwkZQBKAA=',
                calendarColor: '#34AADCFF',
                displayName: '집',
                components: [ 'VEVENT' ],
                resourcetype: [ 'collection', 'calendar' ],
                syncToken: 'HwoQEgwAAECznNlRjQAAAAEYAhgAIhYI14Gx+aCqosLsARDosZjX8YLwkZQBKAA=',
                projectedProps: {},
                reports: [
                    'aclPrincipalPropSet',
                    'principalMatch',
                    'principalPropertySearch',
                    'syncCollection',
                    'calendarQuery',
                    'calendarMultiget',
                    'freeBusyQuery',
                    'calendarSearch'
                ]
            },
            {
                description: '',
                timezone: '',
                url: 'https://caldav.icloud.com/1452332614/calendars/tasks/',
                ctag: 'HwoQEgwAADcr6qELFwAAAAAYARgAIhYIzJe1kJz3msDuARDQ/rTrmsDS568BKAA=',
                calendarColor: '#CC73E1FF',
                displayName: '미리 알림',
                components: [ 'VTODO' ],
                resourcetype: [ 'collection', 'calendar' ],
                syncToken: 'HwoQEgwAADcr6qELFwAAAAAYARgAIhYIzJe1kJz3msDuARDQ/rTrmsDS568BKAA=',
                projectedProps: {},
                reports: [
                    'aclPrincipalPropSet',
                    'principalMatch',
                    'principalPropertySearch',
                    'syncCollection',
                    'calendarQuery',
                    'calendarMultiget',
                    'freeBusyQuery',
                    'calendarSearch'
                ]
            },
            {
                description: '',
                timezone: '',
                url: 'https://caldav.icloud.com/1452332614/calendars/work/',
                ctag: 'HwoQEgwAAD5oK83iFgABAAAYAhgAIhUIwpGt4Mjw+fkkEPv0y5ndhYDHngEoAA==',
                calendarColor: '#CC73E1FF',
                displayName: '직장',
                components: [ 'VEVENT' ],
                resourcetype: [ 'collection', 'calendar' ],
                syncToken: 'HwoQEgwAAD5oK83iFgABAAAYAhgAIhUIwpGt4Mjw+fkkEPv0y5ndhYDHngEoAA==',
                projectedProps: {},
                reports: [
                    'aclPrincipalPropSet',
                    'principalMatch',
                    'principalPropertySearch',
                    'syncCollection',
                    'calendarQuery',
                    'calendarMultiget',
                    'freeBusyQuery',
                    'calendarSearch'
                ]
            }
        ];
    }

    getOAuthTokenMock(): OAuthToken {
        return {
            accessToken: 'access-token-mock',
            refreshToken: 'refresh-token-mock'
        };
    }

    getSyncdayOAuth2TokenResponseMock(): SyncdayOAuth2TokenResponse {
        return {
            issuedToken: {
                accessToken: 'access-token-mock',
                refreshToken: 'refresh-token-mock'
            },
            isNewbie: true,
            insufficientPermission: true
        };
    }

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

    getCreatedCalendarEventMock(): CreatedCalendarEvent {
        return {
            generatedEventUrl: '',
            iCalUID: 'icaluid',
            raw: {}
        };
    }

    getBearerTokenMock(): string {
        // eslint-disable-next-line max-len
        return 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImppaGFuLmxlZTIiLCJzdWIiOiJqaWhhbi5sZWUyK0UwMTY3OEY3LTI4NUYtNDQ4MC1BMDA2LUIzOUY1NjJBMThBOSIsImlhdCI6MTY1MTE5OTAxMSwiZXhwIjoxNjUxODAzODExfQ.umhNz65cHTMgC_05gxqTqWVdSmxZYQviV3Lb_Mw9P34';
    }

    getAvailabilityBodyRecordMocks(
        profileId: number,
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

                    const bodyKey = [profileId, availabilityStub.uuid].join(':');
                    return [
                        bodyKey,
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

    getGoogleOAuth2UserWithToken(): GoogleOAuth2UserWithToken {

        const email = 'private_google_email@sync.day';
        const calendarsMock = this.getGoogleCalendarMock();
        const googleCalendarScheduleBody = this.getGoogleCalendarScheduleBodyMock();

        return {
            googleUser: {
                email
            },
            calendars: calendarsMock,
            schedules: googleCalendarScheduleBody
        } as GoogleOAuth2UserWithToken;
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

    getOverridedAvailabilityTimeMock(partialOverridedAvailabilityTime?: OverridedAvailabilityTime): OverridedAvailabilityTime {
        return {
            targetDate: new Date('2023-07-17 00:00:00'),
            timeRanges: [
                {
                    startTime: '2023-07-17 09:00:00',
                    endTime: '2023-07-17 17:00:00'
                }
            ],
            ...partialOverridedAvailabilityTime
        };
    }

    getZoomCreateMeetingResponseDTOMock(
        partialZoomCreateMeetingResponseDTO?: Partial<ZoomCreateMeetingResponseDTO>
    ): ZoomCreateMeetingResponseDTO {
        return {
            agenda: 'fake schedule name',
            default_password: false,
            duration: '2',
            timezone: 'Asia/Seoul',
            type: MeetingType.Scheduled,
            topic: 'fake schedule name',
            start_time: '2023-07-27 07:30:00',
            ...partialZoomCreateMeetingResponseDTO
        } as ZoomCreateMeetingResponseDTO;
    }

    getConferenceLinkMock(partialConferenceLink?: Partial<ConferenceLink>): ConferenceLink {
        return {
            id: 'fake_conference_link_id',
            name: 'fake_conference_link_name',
            url: 'fake_conference_link_url',
            type: IntegrationVendor.ZOOM,
            ...partialConferenceLink
        } as ConferenceLink;
    }

    getScheduledTimesetMock(): ScheduledTimeset {
        return {
            startTimestamp: new Date('2023-07-27 07:30:00'),
            endTimestamp: new Date('2023-07-27 07:30:00')
        } as ScheduledTimeset;
    }

    getCalDAVCalendarMock(): DAVCalendar & { calendarColor: string } {
        return   {
            description: 'this is a sample',
            timezone: '',
            url: 'https://caldav.icloud.com/1452332614/calendars/home/',
            ctag: 'HwoQEgwAAECznNlRjQAAAAEYAhgAIhYI14Gx+aCqosLsARDosZjX8YLwkZQBKAA=',
            calendarColor: '#34AADCFF',
            displayName: '집',
            components: [ 'VEVENT' ],
            resourcetype: [ 'collection', 'calendar' ],
            syncToken: 'HwoQEgwAAECznNlRjQAAAAEYAhgAIhYI14Gx+aCqosLsARDosZjX8YLwkZQBKAA=',
            projectedProps: {},
            reports: [
                'aclPrincipalPropSet',
                'principalMatch',
                'principalPropertySearch',
                'syncCollection',
                'calendarQuery',
                'calendarMultiget',
                'freeBusyQuery',
                'calendarSearch'
            ]
        };
    }

    getCalDAVCalendarObjectMock(): DAVObject {

        const createdItem = '2023-09-15T04:57:54.000Z';

        return {
            data: {
                type: 'VEVENT',
                params: [],
                created: createdItem,
                description: 'ㅇㅅㅇ',
                end: '2023-09-20T00:00:00.000Z',
                dtstamp: '2023-09-15T05:15:32.000Z',
                start: '2023-09-19T00:00:00.000Z',
                datetype: 'date',
                lastmodified: '2023-09-15T05:15:31.000Z',
                sequence: '1',
                summary: '애플 캘린더',
                uid: '3D4E11ED-BC04-4723-B755-8CEA6DFA216F',
                url: '',
                transparency: 'OPAQUE'
            }
        } as DAVObject;
    }

    getGoogleUserInfoMock(): oauth2_v2.Schema$Userinfo {
        return {
            id: '123456789101112131415',
            email: 'alan@sync.day',
            verified_email: true,
            name: '_alan',
            given_name: '_',
            family_name: 'alan',
            picture: 'https://lh3.googleusercontent.com/a/ABc8efGh-ijkLmNop1rSt3rePVjkfIeN3mCeOMrSIa_Lf6Hho8A=s96-c',
            locale: 'en'
        };
    }

    getGoogleEventsMock(
        calendarKey = 'alan@sync.day'
    ): calendar_v3.Schema$Events {
        return {
            [calendarKey]: [
                {
                    kind: 'calendar#event',
                    etag: '"3150357311349000"',
                    id: '_6kr3gc238kp34b9k70qk2b9k6kr46ba2751k4ba489344h2165148g9h6c',
                    status: 'confirmed',
                    htmlLink: 'https://www.google.com/calendar/event?eid=XzZrcjNnYzIzOGtwMzRiOWs3MHFrMmI5azZrcjQ2YmEyNzUxazRiYTQ4OTM0NGgyMTY1MTQ4ZzloNmNfMjAxNjA0MTUgNHRoc3RvbkBt',
                    created: '2023-10-16T10:49:33.000Z',
                    updated: '2023-10-17T00:25:37.693Z',
                    summary: '개명 기념일',
                    creator: {
                        email: 'alan@sync.day',
                        displayName: 'alan',
                        self: true
                    },
                    organizer: {
                        email: 'alan@sync.day',
                        displayName: 'alan',
                        self: true
                    },
                    start: {
                        date: '2023-04-15'
                    },
                    end: {
                        date: '2025-04-16'
                    },
                    recurrence: [
                        'RRULE:FREQ=YEARLY'
                    ],
                    iCalUID: '5680CE22-485A-789C-B9CB-DBFBDA1BDA13',
                    sequence: 0,
                    reminders: {
                        useDefault: false
                    },
                    eventType: 'default'
                }
            ]
        };
    }

    getGoogleCalendarsMock(): calendar_v3.Schema$CalendarList {
        return {
            kind: 'calendar#calendarList',
            etag: '"p33s9hal3tfso20o"',
            nextSyncToken: 'ABcDefGh-ABCDeF0hIjklM9uQGdtYWlsLmNvbQ==',
            items: [
                {
                    kind: 'calendar#calendarListEntry',
                    etag: '1631269230776000',
                    id: 'en.south_korea#holiday@group.v.calendar.google.com',
                    summary: 'Holidays in South Korea',
                    description: 'Holidays and Observances in South Korea',
                    timeZone: 'Asia/Seoul',
                    colorId: '1',
                    backgroundColor: '#ac725e',
                    foregroundColor: '#000000',
                    selected: true,
                    accessRole: 'reader',
                    defaultReminders: [],
                    conferenceProperties: [] as calendar_v3.Schema$ConferenceProperties
                },
                {
                    kind: 'calendar#calendarListEntry',
                    etag: '1688747380011000',
                    id: 'alan@sync.day',
                    summary: 'alan@sync.day',
                    timeZone: 'Asia/Seoul',
                    colorId: '16',
                    backgroundColor: '#0e61b9',
                    foregroundColor: '#ffffff',
                    selected: true,
                    accessRole: 'owner',
                    defaultReminders: [],
                    notificationSettings: {} as {
                        notifications?: calendar_v3.Schema$CalendarNotification[];
                    },
                    primary: true,
                    conferenceProperties: [] as calendar_v3.Schema$ConferenceProperties
                },
                {
                    kind: 'calendar#calendarListEntry',
                    etag: '1689362322226000',
                    id: '3d5887b1f569d9416b54eb5d5218564f6e24e313d2ef7df6052ca08c89169d19@group.calendar.google.com',
                    summary: 'working',
                    description: 'working',
                    timeZone: 'Asia/Seoul',
                    colorId: '16',
                    backgroundColor: '#4986e7',
                    foregroundColor: '#000000',
                    selected: true,
                    accessRole: 'owner',
                    defaultReminders: [],
                    conferenceProperties: [] as calendar_v3.Schema$ConferenceProperties
                }
            ]

        };
    }

    getGoogleOAuthCallbackRequestMock(
        integrationContext: IntegrationContext
    ): Request {
        return {
            protocol: 'https',
            url: `/v1/tokens/google/callback?state=%7B%22integrationContext%22:%22${integrationContext}%22,%22timezone%22:%22Asia/Seoul%22%7D&code=4/0AfJohXkPyR5k0e9aIfEDCqPny4WMTkWAV-9ffmY8C9mT4zC7l2_D4LlIrz0I-Ab3Lo6yfw&scope=email%20profile%20https://www.googleapis.com/auth/calendar%20openid%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email&authuser=1&prompt=consent`,
            headers: {
                host: 'localhost:3011'
            }
        } as Request;
    }

    getGoogleAuthorizationUrlMock(): string {
        return 'https://accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount?access_type=offline&prompt=select_account%20consent&scope=email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar&include_granted_scopes=true&state=%7B%22integrationContext%22%3A%22sign_in%22%2C%22timezone%22%3A%22Asia%2FSeoul%22%7D&response_type=code&client_id=804392781525-ilthgvpdp39ps7nojhauo1uua5jotg4a.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fapi.stg.sync.day%2Fv1%2Ftokens%2Fgoogle%2Fcallback&service=lso&o2v=2&theme=glif&flowName=GeneralOAuthFlow';
    }

    getZoomUser({
        email,
        timezone
    } = {
        email: 'alan@sync.day',
        timezone: 'Asia/Seoul'
    }): ZoomUserResponseDTO {
        return {
            id: '7weRVdMZT7-Z-ZQcjYbITg',
            first_name: 'Sync',
            last_name: 'Developer',
            display_name: 'Syync Developer',
            email,
            type: 1,
            role_name: 'Owner',
            pmi: 9227567326,
            use_pmi: false,
            personal_meeting_url: 'https://us05web.zoom.us/j/9227567326?pwd=THJLWjBlZGx1NWFtaC9GZWljYlMxQT09',
            timezone,
            verified: 0,
            dept: '',
            created_at: '2023-02-20T05:04:23Z',
            last_login_time: '2023-10-19T02:57:36Z',
            last_client_version: '5.14.2.17213(mac)',
            pic_url: 'https://us05web.zoom.us/p/7weRVdMZT7-Z-ZQcjYbITg/3389ff77-435b-42ee-addc-17099af7d9c3-146    5',
            cms_user_id: '',
            jid: '7wervdmzt7-z-zqcjybitg@xmpp.zoom.us',
            group_ids: [],
            im_group_ids: [],
            account_id: 'vydvDS82ThyYCyeCY76l-w',
            language: 'ko-KO',
            phone_country: '',
            phone_number: '',
            status: 'active',
            job_title: '',
            company: 'Sync',
            location: '',
            login_types: [ 1 ],
            role_id: '0',
            account_number: 5074040974,
            cluster: 'us05',
            user_created_at: '2023-02-20T05:04:23Z',
            integrationUserUniqueId: 'vydvDS82ThyYCyeCY76l-w',
            insufficientPermission: false
        };
    }

    getZoomAuthCode(): string {
        return 'uYPNBQw5QwFF19IRjiCS2-W6kaiGYcEFg';
    }

    getZoomOAuthCallbackRequestMock(
        userAccessToken: string
    ): Request {

        const zoomCallbackUrl = `/v1/integrations/zoom/callback?code=uYPNBQw5QwFF19IRjiCS2-W6kaiGYcEFg&state=%7B%22accessToken%22%3A%22${userAccessToken}%22%7D`;

        return {
            protocol: 'https',
            url: zoomCallbackUrl,
            headers: {
                host: 'localhost:3011'
            },
            req: {
                originalUrl: zoomCallbackUrl
            }
        } as Request & { req: any };
    }

    getZoomMeetingMock(): ZoomCreateMeetingResponseDTO {
        return {
            uuid: '1CiOzIVfQLq91BQXzMFUpw==',
            id: 84153303437,
            host_id: '7weRVdMZT7-Z-ZQcjYbITg',
            host_email: 'partners@sync.day',
            topic: '30 Minute Meeting',
            type: 2,
            status: 'waiting',
            start_time: new Date(),
            duration: 2,
            timezone: 'Asia/Seoul',
            agenda: 'Event Name: 30 Minute Meeting\n' +
              'Location: \n' +
              'Note: testetet\n' +
              '\n' +
              'Powered by Sync.day',
            created_at: new Date(),
            start_url: 'https://us05web.zoom.us/s/84153303437?zak=eyJ0eXAiOiJKV1QiLCJzdiI6IjAwMDAwMSIsInptX3NrbSI6InptX28ybSIsImFsZyI6IkhTMjU2In0.eyJhdWQiOiJjbGllbnRzbSIsInVpZCI6Ijd3ZVJWZE1aVDctWi1aUWNqWWJJVGciLCJpc3MiOiJ3ZWIiLCJzayI6IjAiLCJzdHkiOjEsIndjZCI6InVzMDUiLCJjbHQiOjAsIm1udW0iOiI4NDE1MzMwMzQzNyIsImV4cCI6MTY5MzUzMzkyNywiaWF0IjoxNjkzNTI2NzI3LCJhaWQiOiJ2eWR2RFM4MlRoeVlDeWVDWTc2bC13IiwiY2lkIjoiIn0.l1HYeodjvpYqGM8E5QHL0MwBTjvBmdQkMc6e-WigsRQ',
            join_url: 'https://us05web.zoom.us/j/84153303437?pwd=5FRhadxBYxNZ5RALysPBFY8LBEtDck.1',
            password: 'vgn6x8',
            h323_password: '843724',
            pstn_password: '843724',
            encrypted_password: '5FRhadxBYxNZ5RALysPBFY8LBEtDck.1',
            settings: {
                host_video: false,
                participant_video: false,
                cn_meeting: false,
                in_meeting: false,
                join_before_host: false,
                jbh_time: 0,
                mute_upon_entry: false,
                watermark: false,
                use_pmi: false,
                approval_type: 2,
                audio: Audio.Voip,
                auto_recording: AutoRecording.None,
                enforce_login: false,
                enforce_login_domains: '',
                alternative_hosts: '',
                alternative_host_update_polls: false,
                close_registration: false,
                show_share_button: false,
                allow_multiple_devices: false,
                registrants_confirmation_email: true,
                waiting_room: false,
                request_permission_to_unmute_participants: false,
                registrants_email_notification: true,
                meeting_authentication: false,
                encryption_type: EncryptionType.EnhancedEncryption,
                approved_or_denied_countries_or_regions: { enable: false } as ApprovedOrDeniedCountriesOrRegions,
                breakout_room: { enable: false } as BreakoutRoom,
                internal_meeting: false,
                continuous_meeting_chat: { enable: false, auto_add_invited_external_users: false },
                participant_focused_meeting: false,
                alternative_hosts_email_notification: true,
                show_join_info: false,
                device_testing: false,
                focus_mode: false,
                enable_dedicated_group_chat: false,
                private_meeting: false,
                email_notification: true,
                host_save_video_order: false,
                sign_language_interpretation: { enable: false },
                email_in_attendee_report: false
            },
            pre_schedule: false
        } as unknown as ZoomCreateMeetingResponseDTO;
    }
}
