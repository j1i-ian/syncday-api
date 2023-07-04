import { v4 as uuidv4 } from 'uuid';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { EventType } from '@interfaces/events/event-type.enum';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { UserSetting } from '@entity/users/user-setting.entity';
import { User } from '@entity/users/user.entity';
import { DateTimeOrderFormat } from '@entity/users/date-time-format-order.enum';
import { DateTimeFormatOption } from '@entity/users/date-time-format-option.type';
import { BufferTime } from '@entity/events/buffer-time.entity';
import { DateRange } from '@entity/events/date-range.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Event } from '@entity/events/event.entity';
import { Language } from '@app/enums/language.enum';
import { DateOrder } from '../../interfaces/datetimes/date-order.type';
import { ZoomBasicAuth } from '../../interfaces/zoom-basic-auth.interface';

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
            description: 'default',
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
            link: 'default',
            name: 'default',
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

    getUserDefaultSetting(
        user: Partial<User>,
        language: Language,
        { randomSuffix, timezone }: UserDefaultSettingOption = {
            randomSuffix: false,
            timezone: undefined
        }
    ): Partial<UserSetting> {
        let workspaceName = '';

        if (user.name) {
            workspaceName = user.name;
        } else if (user.email) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const extractedWorkspaceNameFromEmail = user.email.split('@')[0];
            workspaceName = extractedWorkspaceNameFromEmail;
        } else {
            workspaceName = this.generateUUID();
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
}
