import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UpdateResult } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { SyncdayAwsSnsRequest } from '@core/interfaces/notifications/syncday-aws-sns-request.interface';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { TextTemplate } from '@core/interfaces/notifications/text-template.enum';
import { EventType } from '@interfaces/events/event-type.enum';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { Notification } from '@interfaces/notifications/notification';
import { ScheduledReminder } from '@interfaces/scheduled-events/scheduled-reminder';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { ReminderType } from '@interfaces/reminders/reminder-type.enum';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { Role } from '@interfaces/profiles/role.enum';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { HostProfile } from '@interfaces/scheduled-events/host-profile.interface';
import { ProfileStatus } from '@interfaces/profiles/profile-status.enum';
import { PageOption } from '@interfaces/page-option.interface';
import { TimestampSearchOption } from '@interfaces/timestamp-search-option.interface';
import { RedisStores } from '@services/syncday-redis/redis-stores.enum';
import { UserSetting } from '@entity/users/user-setting.entity';
import { User } from '@entity/users/user.entity';
import { DateTimeOrderFormat } from '@entity/users/date-time-format-order.enum';
import { DateTimeFormatOption } from '@entity/users/date-time-format-option.type';
import { BufferTime } from '@entity/events/buffer-time.entity';
import { DateRange } from '@entity/events/date-range.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Event } from '@entity/events/event.entity';
import { ScheduledStatus } from '@entity/scheduled-events/scheduled-status.enum';
import { ScheduledEventNotification } from '@entity/scheduled-events/scheduled-event-notification.entity';
import { NotificationTarget } from '@entity/scheduled-events/notification-target.enum';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { Host } from '@entity/scheduled-events/host.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { Weekday } from '@entity/availability/weekday.enum';
import { AvailableTime } from '@entity/availability/availability-time.entity';
import { Availability } from '@entity/availability/availability.entity';
import { Team } from '@entity/teams/team.entity';
import { Language } from '@app/enums/language.enum';
import { DateOrder } from '../../interfaces/datetimes/date-order.type';
import { InternalBootpayException } from '@exceptions/internal-bootpay.exception';
import { BootpayException } from '@exceptions/bootpay.exception';

interface UserDefaultSettingOption {
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
| 'scheduledEvents'
>;

type SearchOption = Pick<AppJwtPayload, 'teamId' | 'teamUUID' | 'id' | 'uuid' | 'userId'>;

@Injectable()
export class UtilService {
    constructor(private readonly configService: ConfigService) {}

    convertInvitationToProfile(emailOrPhone: string): Profile {

        const isEmail = emailOrPhone.includes('@') === true;

        const invitationUser = isEmail
            ? { email: emailOrPhone, phone: null }
            : { email: null, phone: emailOrPhone };

        return {
            id: -1,
            name: emailOrPhone,
            user: invitationUser,
            roles: [] as Role[],
            status: ProfileStatus.PENDING
        } as Profile;
    }

    patchSearchOption(
        searchOption: Partial<SearchOption & PageOption & TimestampSearchOption>,
        authProfile: AppJwtPayload
    ): Partial<SearchOption & PageOption & TimestampSearchOption> {

        const {
            teamId: queryTeamId,
            id: queryProfileId,
            userId: queryUserId
        } = searchOption;

        const {
            teamId: authTeamId,
            teamUUID: authTeamUUID,
            id: authProfileId,
            userId: authUserId,
            roles
        } = authProfile;

        let parsedSearchOption: Partial<SearchOption> = {};

        const isOwner = roles.includes(Role.OWNER);
        const isManager = roles.includes(Role.MANAGER);
        const hasQueryPermissionByRole = isOwner || isManager;

        const isTeamIdSearch = !!queryTeamId;
        const noTeamSearch = isTeamIdSearch === false;

        const isUserIdSearch = !!(noTeamSearch || queryUserId);
        const isProfileIdSearch = !!(noTeamSearch || queryProfileId);

        const patchedSearchOption: SearchOption =  (
            hasQueryPermissionByRole
                ? {
                    teamId: authTeamId,
                    teamUUID: authTeamUUID,
                    id: queryProfileId,
                    userId: queryUserId
                } : {
                    teamId: authTeamId,
                    teamUUID: authTeamUUID,
                    id: authProfileId,
                    userId: authUserId,
                    uuid: authProfile.uuid
                }
        )as SearchOption;

        parsedSearchOption = {
            teamId: patchedSearchOption.teamId,
            teamUUID: patchedSearchOption.teamUUID,
            id: isProfileIdSearch ? patchedSearchOption.id : undefined,
            userId: isUserIdSearch ? patchedSearchOption.userId : undefined
        };

        const page = searchOption.page && +searchOption.page;
        const take = searchOption.take && +searchOption.take;

        const since = searchOption.since && +searchOption.since;
        const until = searchOption.until && +searchOption.until;

        return {
            ...searchOption,
            ...parsedSearchOption,
            page,
            take,
            since,
            until
        };
    }

    getProration(
        amount: number,
        paymentPeriod: Date
    ): number {

        const aDay = (1000 * 60 * 60 * 24);

        const prorationDate = Math.floor((Date.now() - new Date(paymentPeriod).getTime()) / aDay);

        const pricePerDate = amount / 31;

        const proration = Math.ceil(pricePerDate * prorationDate / 10) * 10;

        return proration;
    }

    convertToBootpayException(bootpayError: InternalBootpayException): BootpayException {

        const bootpayException = new BootpayException(bootpayError.message);
        bootpayException.name = bootpayError.error_code;
        bootpayException.message = bootpayError.message;

        return bootpayException;
    }

    convertToInvitedNewTeamMember(emailOrPhone: string): InvitedNewTeamMember {
        return emailOrPhone.includes('@')
            ? { email: emailOrPhone }
            : { phone: emailOrPhone };
    }

    convertUpdateResultToBoolean(updateResult: UpdateResult): boolean {
        return Boolean(
            updateResult?.affected
            && updateResult.affected > 0
        );
    }

    isValidRoleUpdateRequest(
        authRoles: Role[],
        desireRoles: Role[]
    ): boolean {

        let isValidRequest: boolean;

        const isOwner = authRoles.includes(Role.OWNER);
        const isOwnerPermissionUpdateRequest = desireRoles.includes(Role.OWNER);

        if (isOwner) {
            isValidRequest = true;
        } else if (isOwnerPermissionUpdateRequest) {
            isValidRequest = false;
        } else {
            isValidRequest = true;
        }

        return isValidRequest;
    }

    createNewProfile(
        teamId: number,
        userId: number
    ): Partial<Profile> {
        return {
            teamId,
            userId
        } as Partial<Profile>;
    }

    convertIntegrationVendorToOAuth2Type(
        integrationVendor: IntegrationVendor
    ): OAuth2Type {

        let oauth2Type: OAuth2Type;
        switch (integrationVendor) {
            case IntegrationVendor.GOOGLE:
                oauth2Type = OAuth2Type.GOOGLE;
                break;
            case IntegrationVendor.KAKAOTALK:
                oauth2Type = OAuth2Type.KAKAOTALK;
                break;
            case IntegrationVendor.APPLE:
            case IntegrationVendor.ZOOM:
            default:
                throw new BadRequestException('Unsupported oauth2 type');
                break;
        }

        return oauth2Type;
    }

    convertScheduleNotificationToNotificationDataAndPublishKey(
        scheduleNotification: ScheduledEventNotification
    ): {
            notificationData: SyncdayAwsSnsRequest;
            syncdayNotificationPublishKey: SyncdayNotificationPublishKey;
        } {

        const notificationOrReminderType =
        scheduleNotification.notificationType === NotificationType.EMAIL ?
            scheduleNotification.notificationType :
            scheduleNotification.reminderType;

        const isNotificationTargetHost = scheduleNotification.notificationTarget === NotificationTarget.HOST;

        let template: EmailTemplate | TextTemplate = isNotificationTargetHost ?
            TextTemplate.EVENT_CANCELLED_HOST : TextTemplate.EVENT_CANCELLED_INVITEE;

        let syncdayNotificationPublishKey: SyncdayNotificationPublishKey;

        switch (notificationOrReminderType) {
            case ReminderType.SMS:
                syncdayNotificationPublishKey = SyncdayNotificationPublishKey.SMS_GLOBAL;
                break;
            case ReminderType.WAHTSAPP:
                syncdayNotificationPublishKey = SyncdayNotificationPublishKey.WHATSAPP;
                break;
            case ReminderType.KAKAOTALK:
                syncdayNotificationPublishKey = SyncdayNotificationPublishKey.KAKAOTALK;
                break;
            default:
                template = EmailTemplate.CANCELLED;
                syncdayNotificationPublishKey = SyncdayNotificationPublishKey.EMAIL;
                break;
        }

        const notificationData = {
            template,
            scheduledEventId: scheduleNotification.scheduledEventId
        } as SyncdayAwsSnsRequest;

        const notificationDataAndPublishKey = {
            notificationData,
            syncdayNotificationPublishKey
        };

        return notificationDataAndPublishKey;
    }

    convertReminderTypeToSyncdayNotificationPublishKey(
        reminderType: ReminderType
    ): SyncdayNotificationPublishKey {

        let syncdayNotificationPublishKey: SyncdayNotificationPublishKey;

        switch (reminderType)  {
            case ReminderType.SMS:
                syncdayNotificationPublishKey = SyncdayNotificationPublishKey.SMS_GLOBAL;
                break;
            case ReminderType.WAHTSAPP:
                syncdayNotificationPublishKey = SyncdayNotificationPublishKey.WHATSAPP;
                break;
            case ReminderType.KAKAOTALK:
                syncdayNotificationPublishKey = SyncdayNotificationPublishKey.KAKAOTALK;
                break;
            default:
                throw new Error('Unsupported reminder type');
        }

        return syncdayNotificationPublishKey;
    }

    /**
     * In the correct integration context,
     * if a user who is already signed in requests a 'sign up',
     * it should automatically correct this to a 'sign in' request."
     *
     * @param integrationContext
     * @param loadedUserOrNull
     * @param loadedOAuth2AccountOrNull
     * @param integrationOrNull
     * @returns
     */
    ensureIntegrationContext(
        integrationContext: IntegrationContext,
        loadedUserOrNull: User | null,
        loadedOAuth2AccountOrNull: OAuth2Account | null
    ): IntegrationContext {

        const isNewbie = loadedUserOrNull === null;
        const isMultipleSocialSignIn = loadedUserOrNull !== null &&
            loadedOAuth2AccountOrNull === null &&
            integrationContext !== IntegrationContext.INTEGRATE;

        /**
         * When the integration entity is null,
         * we can handle it in two ways:
         * either by providing options for multiple social sign-ins
         * or, if not applicable,
         * by patching the integration context to enable sign-in
         * through an alternative (else) block.
         */
        const isSignIn = loadedUserOrNull &&
            loadedOAuth2AccountOrNull &&
            integrationContext !== IntegrationContext.INTEGRATE;

        let ensureIntegrationContext = IntegrationContext.SIGN_IN;

        if (isNewbie) {
            ensureIntegrationContext = IntegrationContext.SIGN_UP;
        } else if (isMultipleSocialSignIn) {
            ensureIntegrationContext = IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN;
        } else if (isSignIn) {
            ensureIntegrationContext = IntegrationContext.SIGN_IN;
        } else {
            ensureIntegrationContext = integrationContext;
        }

        return ensureIntegrationContext;
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

    comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    generateRandomNumberString(digit: number, prefix = '0'): string {
        return String(Math.floor(Math.random() * Math.pow(10, digit))).padStart(digit, prefix);
    }

    filterInvitedNewUsers(
        invitedMembers: InvitedNewTeamMember[],
        searchedUsers: User[]
    ): InvitedNewTeamMember[] {
        return invitedMembers
            .filter((_member) => {
                const _searched = searchedUsers.find((_user) => {
                    let _found = false;
                    if (_member.email && _user.email) {
                        _found = _user.email.includes(_member.email);
                    } else if (_member.phone && _user.phone) {
                        _found = _user.phone.includes(_member.phone);
                    } else {
                        _found = false;
                    }
                    return _found;
                });

                return _searched === undefined;
            });
    }

    getDefaultEvent(patchBody?: Partial<Event> & { hasNoEmailUser?: boolean }): Event {

        const _0min = '00:00:00';

        const initialBufferTime = new BufferTime();
        initialBufferTime.before = _0min;
        initialBufferTime.after = _0min;

        const initialDateRange = new DateRange();
        initialDateRange.until = 60;

        const hostNotificationUUID = this.generateUUID();
        const emailReminderUUID = this.generateUUID();

        const defaultNotification = patchBody?.hasNoEmailUser ?
            {} :
            {
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
            };

        const initialEventDetail = new EventDetail({
            description: null,
            inviteeQuestions: [],
            eventSetting: {
                enforceInviteePhoneInput: false
            },
            notificationInfo: defaultNotification
        } as EventDetailInit);

        const defaultLink = '30-minute-meeting';
        const lowercasedLinkWithDashes = patchBody?.link?.toLowerCase().replaceAll(' ', '-') || defaultLink;
        const eventTypesType = patchBody?.type || EventType.ONE_ON_ONE;

        const initialEvent = new Event({
            name: '30 Minute Meeting',
            type: eventTypesType,
            bufferTime: initialBufferTime,
            dateRange: initialDateRange,
            contacts: [],
            ...patchBody,
            link: lowercasedLinkWithDashes
        });
        initialEvent.eventDetail = plainToInstance(EventDetail, {
            ...initialEventDetail,
            ...patchBody?.eventDetail
        });

        return initialEvent;
    }

    getDefaultAvailability(
        language: Language,
        timezone: string
    ): Availability {
        const availabilityDefaultName = this.getDefaultAvailabilityName(language);

        const defaultAvailableTimes: AvailableTime[] = this.getDefaultAvailableTimes();

        return new Availability({
            name: availabilityDefaultName,
            availableTimes: defaultAvailableTimes,
            overrides: [],
            timezone,
            default: true
        });
    }

    getPatchedScheduledEvent(
        team: Team,
        hostUser: User,
        mainProfile: Profile,
        profiles: Profile[],
        sourceEvent: Event,
        newScheduledEvent: ScheduledEvent,
        workspace: string,
        timezone: string
    ): ScheduledEvent {
        newScheduledEvent.uuid = this.generateUUID();
        newScheduledEvent.name = sourceEvent.name;
        newScheduledEvent.color = sourceEvent.color;
        newScheduledEvent.status = ScheduledStatus.OPENED;
        newScheduledEvent.contacts = sourceEvent.contacts;
        newScheduledEvent.type = sourceEvent.type;

        newScheduledEvent.additionalDescription = sourceEvent.eventDetail.description;

        newScheduledEvent.scheduledNotificationInfo.host = sourceEvent.eventDetail.notificationInfo?.host;
        newScheduledEvent.conferenceLinks = [];

        const language = hostUser.userSetting.preferredLanguage;

        newScheduledEvent.host = {
            uuid: mainProfile.uuid,
            name: mainProfile.name,
            workspace
        } as Host;

        newScheduledEvent.hostProfiles = profiles.map((_profile) => ({
            profileId: _profile.id,
            profileUUID: _profile.uuid,
            name: _profile.name,
            workspace,
            timezone,
            language
        } as HostProfile));

        newScheduledEvent.scheduledEventNotifications = this.getPatchedScheduleNotification(
            hostUser,
            mainProfile,
            newScheduledEvent,
            sourceEvent.eventDetail.notificationInfo,
            newScheduledEvent.scheduledNotificationInfo
        );

        // patch consumerable data
        newScheduledEvent.teamId = team.id;
        newScheduledEvent.teamUUID = team.uuid;
        newScheduledEvent.eventId = sourceEvent.id;
        newScheduledEvent.eventUUID = sourceEvent.uuid;

        return newScheduledEvent;
    }

    // FIXME: it should be replaced with scheduled event notification creating directly.
    getPatchedScheduleNotification(
        hostUser: User,
        mainProfile: Profile,
        scheduledEvent: ScheduledEvent,
        sourceNotificationInfo: NotificationInfo,
        notificationInfo: NotificationInfo
    ): ScheduledEventNotification[] {

        const allScheduledEventNotifications = Object.entries(notificationInfo)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .filter(([_hostOrInvitee, _notifications]: [string, Notification[]]) => !!_notifications)
            // merge notification info
            .map(([_hostOrInvitee, _notifications]: [string, Notification[]]) => {

                const mergedNotifications: Notification[] = _notifications.map((_scheduleNotification) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
                    const matchedHostNotification = (sourceNotificationInfo as any)[_hostOrInvitee]?.find(
                        (_sourceNotification: { type: NotificationType }) => _sourceNotification.type === _scheduleNotification.type
                    ) as Notification;

                    const sourceReminder = matchedHostNotification?.reminders[0];

                    _scheduleNotification.reminders = _scheduleNotification.reminders.map((_scheduleNotificationReminder) => ({
                        ..._scheduleNotificationReminder,
                        ...sourceReminder
                    })) as ScheduledReminder[];

                    return _scheduleNotification;

                });

                return [_hostOrInvitee, mergedNotifications] as [string, Notification[]];
            })
            .flatMap(([hostOrInvitee, notifications]: [string, Notification[]]) => {
                const isHost = hostOrInvitee === 'host';
                const notificationTarget: NotificationTarget = isHost ? NotificationTarget.HOST : NotificationTarget.INVITEE;

                const _scheduledEventNotifications = notifications.filter((_notification) => {

                    let isValid = false;
                    if (isHost) {
                        const noHostPhone =
                            _notification.type === NotificationType.TEXT
                            && !hostUser.phone;
                        const noHostEmail =
                            _notification.type === NotificationType.EMAIL
                            && !hostUser.email;
                        isValid = !noHostPhone && !noHostEmail;
                    } else {
                        isValid = true;
                    }

                    return isValid;
                }).flatMap(
                    (_notification) => _notification.reminders
                        .map((__reminder) => {

                            const hostOrInviteeReminderValue = isHost ?
                                this.getHostValue(
                                    hostUser,
                                    _notification.type
                                ) : (__reminder as ScheduledReminder).typeValue;

                            const remindAt = new Date(scheduledEvent.scheduledTime.startTimestamp);

                            if (__reminder.remindBefore) {
                                const [ hour, minute ] = (__reminder.remindBefore as string).split(':');
                                remindAt.setHours(remindAt.getHours() - +hour);
                                remindAt.setMinutes(remindAt.getMinutes() - +minute);
                            }

                            let deletedAt: Date | null = null;

                            if (isHost === false) {

                                const found = sourceNotificationInfo.invitee?.some((_inviteeNotification) =>
                                    _notification.type === _inviteeNotification.type ||
                                    _inviteeNotification.reminders.some(
                                        (___inviteeReminder) => ___inviteeReminder.type === __reminder.type
                                    )
                                );

                                deletedAt = found ? null : new Date();
                            }

                            return {
                                notificationTarget,
                                notificationType: _notification.type,
                                reminderType: __reminder.type,
                                reminderValue: hostOrInviteeReminderValue,
                                remindAt,
                                profileId: mainProfile.id,
                                deletedAt
                            } as ScheduledEventNotification;
                        })
                );

                return _scheduledEventNotifications;
            });

        return allScheduledEventNotifications;
    }

    getHostValue(
        host: User,
        notificationType: NotificationType
    ): string {

        let value: string;

        if (notificationType === NotificationType.EMAIL && host.email) {
            value = host.email;
        } else if (notificationType === NotificationType.TEXT && host.phone) {
            value = host.phone;
        } else {
            throw new InternalServerErrorException('Invalid notification type and host setting');
        }

        return value;
    }

    getUserDefaultSetting(
        language: Language,
        { timezone }: UserDefaultSettingOption = {
            timezone: undefined
        }
    ): Partial<UserSetting> {

        const { dateTimeFormatOption, dateTimeOrderFormat } = this.getDefaultDateTimeFormat(
            language,
            timezone as string
        );

        return {
            preferredLanguage: language,
            preferredTimezone: timezone,
            preferredDateTimeOrderFormat: dateTimeOrderFormat,
            preferredDateTimeFormat: dateTimeFormatOption
        };
    }

    getDefaultTeamWorkspace(
        workspace?: string | null,
        email?: string | null,
        phoneNumber?: string | null,
        {
            randomSuffix
        } = {
            randomSuffix: false
        }
    ): string {

        const emailId = email?.replaceAll('.', '').split('@').shift();

        const patchedPhoneNumber = phoneNumber?.replace('+82', '0');

        workspace = workspace ??
                emailId ??
                patchedPhoneNumber ??
                '';

        if (randomSuffix) {
            const randomNumberString = this.generateRandomNumberString(4);
            workspace += randomNumberString;
        }

        return workspace;
    }

    getDefaultAvailableTimes(): AvailableTime[] {

        const workingDaysCount = Weekday.FRIDAY - Weekday.MONDAY + 1;

        const initialAvailableTimes = Array(workingDaysCount)
            .fill(undefined)
            .map((_el, index) => index + 1)
            .map((weekdayIndex) => {
                const _initialAvailableTime = new AvailableTime();
                _initialAvailableTime.day = weekdayIndex;
                _initialAvailableTime.timeRanges = [
                    {
                        startTime: '09:00:00',
                        endTime: '17:00:00'
                    }
                ];

                return _initialAvailableTime;
            });

        return initialAvailableTimes;
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
        let defaultWorkingHoursText = 'Working hours';

        switch (language) {
            case Language.KOREAN:
                defaultWorkingHoursText = '근무 시간';
                break;
            case Language.ENGLISH:
            default:
                defaultWorkingHoursText = 'Working hours';
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
