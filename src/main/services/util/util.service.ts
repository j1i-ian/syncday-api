import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { EventType } from '@interfaces/events/event-type.enum';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { Notification } from '@interfaces/notifications/notification';
import { ScheduledReminder } from '@interfaces/schedules/scheduled-reminder';
import { RedisStores } from '@services/syncday-redis/redis-stores.enum';
import { UserSetting } from '@entity/users/user-setting.entity';
import { User } from '@entity/users/user.entity';
import { DateTimeOrderFormat } from '@entity/users/date-time-format-order.enum';
import { DateTimeFormatOption } from '@entity/users/date-time-format-option.type';
import { BufferTime } from '@entity/events/buffer-time.entity';
import { DateRange } from '@entity/events/date-range.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Event } from '@entity/events/event.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { ScheduledStatus } from '@entity/schedules/scheduled-status.enum';
import { ScheduledEventNotification } from '@entity/schedules/scheduled-event-notification.entity';
import { NotificationTarget } from '@entity/schedules/notification-target.enum';
import { Language } from '@app/enums/language.enum';
import { DateOrder } from '../../interfaces/datetimes/date-order.type';
import { ZoomBasicAuth } from '../../interfaces/zoom-basic-auth.interface';

type LocalizedDate = {
    [key in keyof Intl.DateTimeFormatOptions]: string;
};

interface UserDefaultSettingOption {
    randomSuffix: boolean;
    timezone?: string;
}

interface DefaultDateTimeFormat {
    dateTimeFormatOption: DateTimeFormatOption;
    dateTimeOrderFormat: DateTimeOrderFormat[];
}

type EventDetailInit = Omit<EventDetail,
'id'
| 'uuid'
| 'createdAt'
| 'updatedAt'
| 'deletedAt'
| 'eventId'
| 'event'
| 'interval'
| 'minimumNotice'
| 'schedules'
>;

@Injectable()
export class UtilService {
    constructor(private readonly configService: ConfigService) {}

    dateToTimeString(
        date: Date,
        timezone: string
    ): string {

        const formatPartObject = this.localizeDateTimeFormatPartObject(date, timezone);

        const localizedHour = String(formatPartObject.hour).padStart(2, '0');
        const localizedMins = String(formatPartObject.minute).padStart(2, '0');

        return `${localizedHour}:${localizedMins}`;
    }

    /**
     * @param timeString ex) 10:00
     */
    localizeDateTime(
        date: Date,
        timezone: string,
        timeString: string
    ): Date {

        const formatPartObject = this.localizeDateTimeFormatPartObject(date, timezone);

        const year = formatPartObject['year'] as string;
        const month = formatPartObject['month'] as string;
        const day = formatPartObject['day'] as string;
        const GMTShortString = formatPartObject['timeZoneName'] as string;

        const YYYYMMDD = `${year}-${month}-${day}`;
        const parsedDate = new Date(`${YYYYMMDD} ${timeString}:00 ${GMTShortString}`);

        return parsedDate;
    }

    localizeDateTimeFormatPartObject(
        date: Date,
        timezone: string
    ): LocalizedDate {

        const formatPartEntries = new Intl.DateTimeFormat('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: timezone,
            timeZoneName: 'short'
        }).formatToParts(date)
            .map((_formatPart) => [_formatPart.type, _formatPart.value]);

        const formatPartObject = Object.fromEntries(formatPartEntries);

        return formatPartObject;
    }

    generenateGoogleMeetLink(): string {
        const meetCode = this.generenateGoogleMeetCode();

        return `https://meet.google.com/${meetCode}`;
    }

    generenateGoogleMeetCode(): string {

        const first = this.generateRandomAlphabet(3);
        const middle = this.generateRandomAlphabet(4);
        const last = this.generateRandomAlphabet(3);

        return `${first}-${middle}-${last}`;
    }

    generateRandomAlphabet(num: number): string {

        const alphabetDiff = ('z'.charCodeAt(0) - 'a'.charCodeAt(0));

        return Array(num).fill(0)
            .map(() => String.fromCharCode(Math.floor(Math.random() * 100 % alphabetDiff) + 'a'.charCodeAt(0)))
            .join('');
    }

    generateUUID(): string {
        return uuidv4();
    }

    generateUniqueNumber(): number {
        // eslint-disable-next-line no-bitwise
        return Math.abs(Math.floor((Date.now() << 2) / 100));
    }

    hash(plainText: string): string {
        const salt = bcrypt.genSaltSync(5);
        const hashedPassword = bcrypt.hashSync(plainText, salt);

        return hashedPassword;
    }

    generateRandomNumberString(digit: number, prefix = '0'): string {
        return String(Math.floor(Math.random() * Math.pow(10, digit))).padStart(digit, prefix);
    }

    getDefaultEvent(patchBody?: Partial<Event>): Event {

        const _0min = '00:00:00';

        const initialBufferTime = new BufferTime();
        initialBufferTime.before = _0min;
        initialBufferTime.after = _0min;

        const initialDateRange = new DateRange();
        initialDateRange.until = 60;

        const hostNotificationUUID = this.generateUUID();
        const emailReminderUUID = this.generateUUID();

        const initialEventDetail = new EventDetail({
            description: null,
            inviteeQuestions: [],
            eventSetting: {
                enforceInviteePhoneInput: false
            },
            notificationInfo: {
                host: [
                    {
                        uuid: hostNotificationUUID,
                        type: NotificationType.EMAIL,
                        reminders: [
                            {
                                remindBefore: '01:00:00',
                                uuid: emailReminderUUID
                            }
                        ]
                    }
                ],
                invitee: [
                    {
                        uuid: hostNotificationUUID,
                        type: NotificationType.EMAIL,
                        reminders: [
                            {
                                remindBefore: '01:00:00',
                                uuid: emailReminderUUID
                            }
                        ]
                    }
                ]
            }
        } as EventDetailInit);

        const initialEvent = new Event({
            type: EventType.ONE_ON_ONE,
            link: '30 Minute Meeting',
            name: '30 Minute Meeting',
            bufferTime: initialBufferTime,
            dateRange: initialDateRange,
            contacts: [],
            eventDetail: initialEventDetail,
            ...patchBody
        });
        initialEvent.eventDetail = initialEventDetail;

        return initialEvent;
    }

    getZoomBasicAuth(zoomBasicAuth: ZoomBasicAuth): string {
        const { clientId, clientSecret } = zoomBasicAuth;
        const basicAuthValue = clientId + ':' + clientSecret;
        return Buffer.from(basicAuthValue).toString('base64');
    }

    getPatchedScheduledEvent(sourceEvent: Event, newSchedule: Schedule, workspace: string, timezone: string): Schedule {
        newSchedule.name = sourceEvent.name;
        newSchedule.color = sourceEvent.color;
        newSchedule.status = ScheduledStatus.OPENED;
        newSchedule.contacts = sourceEvent.contacts;
        newSchedule.type = sourceEvent.type;
        newSchedule.eventDetailId = sourceEvent.eventDetail.id;

        newSchedule.host = {
            workspace,
            timezone
        };

        newSchedule.scheduledEventNotifications = this.getPatchedScheduleNotification(newSchedule.scheduledNotificationInfo);

        return newSchedule;
    }

    getPatchedScheduleNotification(notificationInfo: NotificationInfo): ScheduledEventNotification[] {

        const allScheduledEventNotifications = Object.entries(notificationInfo)
            .flatMap(([hostOrInvitee, notifications]: [string, Notification[]]) => {
                const notificationTarget: NotificationTarget = hostOrInvitee === 'host' ? NotificationTarget.HOST : NotificationTarget.INVITEE;

                const _scheduledEventNotifications = notifications.flatMap(
                    (_notification) => _notification.reminders.map((__reminder) => ({
                        notificationTarget,
                        notificationType: _notification.type,
                        reminderType: __reminder.type,
                        reminderValue: (__reminder as ScheduledReminder).typeValue,
                        remindAt: __reminder.remindBefore
                    } as ScheduledEventNotification))
                );

                return _scheduledEventNotifications;
            });

        return allScheduledEventNotifications;
    }

    getUserDefaultSetting(
        user: Partial<User>,
        language: Language,
        { randomSuffix, timezone }: UserDefaultSettingOption = {
            randomSuffix: false,
            timezone: undefined
        }
    ): Partial<UserSetting> {
        let workspaceName: string | undefined = user.userSetting?.workspace;

        if (!workspaceName) {
            if (user.email) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                const extractedWorkspaceNameFromEmail = user.email.split('@')[0];
                workspaceName = extractedWorkspaceNameFromEmail;
            } else if (user.name) {
                workspaceName = user.name;
            } else {
                workspaceName = this.generateUUID();
            }
        }

        if (randomSuffix) {
            const randomNumberString = this.generateRandomNumberString(4);
            workspaceName += randomNumberString;
        }

        const { dateTimeFormatOption, dateTimeOrderFormat } = this.getDefaultDateTimeFormat(
            language,
            timezone as string
        );

        return {
            workspace: workspaceName,
            preferredLanguage: language,
            preferredTimezone: timezone,
            preferredDateTimeOrderFormat: dateTimeOrderFormat,
            preferredDateTimeFormat: dateTimeFormatOption
        };
    }

    getDefaultDateTimeFormat(language: Language, timezone: string): DefaultDateTimeFormat {
        const formatter = new Intl.DateTimeFormat(language, {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const dateTimeFormatOrderType: DateOrder = ['year', 'month', 'day'];
        const dateTimeOrderFormat = formatter
            .formatToParts()
            .filter((formatPart) =>
                dateTimeFormatOrderType.includes(formatPart.type as 'year' | 'month' | 'day')
            )
            .map((formatPart) => formatPart.type) as DateTimeOrderFormat[];

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { locale, calendar, numberingSystem, timeZone, ...dateTimeFormatOption } =
            formatter.resolvedOptions();

        const dateTimeFomat: DefaultDateTimeFormat = {
            dateTimeFormatOption: dateTimeFormatOption as DateTimeFormatOption,
            dateTimeOrderFormat
        };
        return dateTimeFomat;
    }

    getDefaultAvailabilityName(language: Language): string {
        let defaultWorkingHoursText = 'Work hours';

        switch (language) {
            case Language.KOREAN:
                defaultWorkingHoursText = '근무 시간';
                break;
            case Language.ENGLISH:
            default:
                defaultWorkingHoursText = 'Work hours';
        }

        return defaultWorkingHoursText;
    }

    /**
     * @param pathname /event-groups/1 형태의 문자열
     */
    getGroupEventIdFromPath(pathname: string): number {
        const pathArray = pathname.split('/');
        const validPath =
            pathArray[1] === 'event-groups' && !Number.isNaN(+pathArray[2]) && +pathArray[2];

        if (!validPath) {
            throw new BadRequestException('invalid event group path');
        }

        return validPath;
    }

    getFullRedisKey(key: string): string {
        const fullname = `${this.configService.get<string>('ENV') as string}:${key}`;

        return fullname;
    }

    getRedisKey(store: RedisStores, value: string[]): string {
        return [store, ...value].join(':');
    }

    generateFilePath(inputFilename: string, prefix = 'images'): string {
        const yyyymmdd = this.toYYYYMMDD(new Date(), '');
        const fileUuid = this.uuid(36, '-', '-');
        const filename = `${yyyymmdd}/${fileUuid}/${inputFilename}`;
        const fileFullPath = `${prefix}/${filename}`;

        return fileFullPath;
    }

    toYYYYMMDD(target: Date, joiner = '-'): string {
        const YYYY = target.getFullYear();

        const _MM = target.getMonth() + 1;
        const MM = _MM < 10 ? `0${_MM}` : _MM;

        const _DD = target.getDate();
        const DD = _DD < 10 ? `0${_DD}` : _DD;

        return [YYYY, MM, DD].join(joiner);
    }

    uuid(length = 36, splitter = '-', joiner = ''): string {
        const randomUUID = crypto
            .randomUUID({ disableEntropyCache: false })
            .split(splitter)
            .join(joiner);
        return randomUUID.toUpperCase().slice(0, length);
    }
}
