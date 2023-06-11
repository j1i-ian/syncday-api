/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/unified-signatures */
import 'reflect-metadata';

import { SinonSandbox } from 'sinon';

import { ArgumentsHost } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UpdateResult } from 'typeorm';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { calendar_v3 } from 'googleapis';
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
import { Verification } from '@entity/verifications/verification.entity';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
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

        return plainToInstance(Verification, {
            email: emailMock,
            verificationCode: '1423'
        });
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

    getAvailabilityBodyMock(availability?: Availability): AvailabilityBody {
        if (!availability) {
            availability = stubOne(Availability);
        }

        return {
            availableTimes: [],
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

    getReminderMock(reminder?: Partial<Reminder>): Reminder {
        return {
            remindBefore: '10',
            type: ReminderType.SMS,
            uuid: faker.datatype.uuid(),
            ...reminder
        };
    }

    getGoogleCalendarMock(): calendar_v3.Schema$CalendarList {
        return {
            nextSyncToken: faker.datatype.uuid(),
            items: [
                {
                    accessRole: GoogleCalendarAccessRole.OWNER,
                    primary: true,
                    description: 'testDescription'
                }
            ]
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
}
