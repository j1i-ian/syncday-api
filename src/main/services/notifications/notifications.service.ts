import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, combineLatest, from, map, mergeMap, reduce, tap } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { MessageAttributeValue, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { SyncdayAwsSnsRequest } from '@core/interfaces/notifications/syncday-aws-sns-request.interface';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { BookingRequest } from '@core/interfaces/notifications/text-templates/booking-request.interface';
import { TextTemplate } from '@core/interfaces/notifications/text-template.enum';
import { InvitationNotification } from '@core/interfaces/notifications/text-templates/invitation-notification-request.interface';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { AppConfigService } from '@config/app-config.service';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { ReminderType } from '@interfaces/reminders/reminder-type.enum';
import { InvitedNewTeamMember } from '@interfaces/users/invited-new-team-member.type';
import { ScheduledStatus } from '@interfaces/scheduled-events/scheduled-status.enum';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { ScheduledEventNotification } from '@entity/scheduled-events/scheduled-event-notification.entity';
import { Language } from '@app/enums/language.enum';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly utilService: UtilService,
        private readonly eventsService: EventsService,
        private readonly teamSettingService: TeamSettingService,
        private readonly configService: ConfigService,
        private readonly syncdayAwsSdkClientService: SyncdayAwsSdkClientService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    sendScheduledEventNotifications(
        scheduledEventId: number,
        scheduledEventNotifications: ScheduledEventNotification[]
    ): Observable<boolean> {

        const publishKeySet = new Set<SyncdayNotificationPublishKey>();

        scheduledEventNotifications.forEach((_scheduledEventNotification) => {
            const syncdayNotificationPublishKey = this.utilService.getSyncdayNotificationPublishKey(_scheduledEventNotification);
            publishKeySet.add(syncdayNotificationPublishKey);
        });

        this.logger.info({
            message: 'Booking confirm notification is sending..',
            scheduledEventId
        });

        const publishKeyArray = [...publishKeySet.values()];

        const messageAttribute: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify(publishKeyArray)
        };

        return from(this._sendNotification(
            messageAttribute,
            {
                scheduledEventStatus: ScheduledStatus.CONFIRMED,
                scheduledEventId
            } as SyncdayAwsSnsRequest
        ));
    }

    sendTeamInvitation(
        teamName: string,
        hostName: string,
        invitedNewTeamMembers: InvitedNewTeamMember[],
        isAlreadySignedUpSyncUser: boolean
    ): Observable<boolean> {

        this.logger.info({
            message: 'Team Invitation Notification is sending..',
            teamName,
            hostName,
            invitedNewTeamMembersLength: invitedNewTeamMembers.length
        });

        return from(invitedNewTeamMembers)
            .pipe(
                map((invitedNewTeamMember) => ({
                    hostName,
                    teamName,
                    invitedNewTeamMember,
                    isAlreadySignedUpSyncUser
                } as InvitationNotification)),
                mergeMap((invitationNotificationRequest) => {

                    let syncdayNotificationPublishKey = SyncdayNotificationPublishKey.EMAIL;
                    let phoneNumber: string | undefined;
                    let email: string | undefined;
                    let template: TextTemplate | EmailTemplate;

                    const {
                        invitedNewTeamMember: {
                            email: inviteeEmail,
                            phone: inviteePhone
                        }
                    } = invitationNotificationRequest;

                    if (inviteeEmail) {
                        syncdayNotificationPublishKey = SyncdayNotificationPublishKey.EMAIL;
                        template = EmailTemplate.INVITATION;

                        email = inviteeEmail;
                    } else {

                        phoneNumber = inviteePhone as string;

                        const isKoreanPhoneNumber = phoneNumber.includes('+82');

                        syncdayNotificationPublishKey = isKoreanPhoneNumber
                            ? SyncdayNotificationPublishKey.KAKAOTALK
                            : SyncdayNotificationPublishKey.SMS_GLOBAL;

                        template = TextTemplate.INVITATION;
                    }

                    this.logger.info({
                        message: 'Trying to send a message..',
                        teamName,
                        template,
                        email,
                        invitationNotificationRequest
                    });

                    return this.sendMessage(
                        syncdayNotificationPublishKey,
                        {
                            template,
                            data: JSON.stringify(invitationNotificationRequest),
                            phoneNumber,
                            email
                        } as SyncdayAwsSnsRequest
                    );
                }),
                reduce((acc, curr) => acc && curr),
                tap(() => {
                    this.logger.info({
                        message: 'Team Invitation Notification has been sent.',
                        teamName
                    });
                })
            );
    }

    sendBookingRequest(
        teamId: number,
        eventId: number,
        reminderType: ReminderType,
        hostName: string,
        inviteeName: string,
        phoneNumber: string,
        additionalMessage?: string,
        language?: Language | undefined
    ): Observable<boolean> {

        const syncdayNotificationPublishKey = this.utilService.convertReminderTypeToSyncdayNotificationPublishKey(reminderType);

        this.logger.info({
            message: 'booking request',
            eventId,
            phoneNumber,
            syncdayNotificationPublishKey,
            language
        });

        // load event by event id
        return combineLatest([
            this.eventsService.findOne(eventId, teamId),
            from(this.teamSettingService.fetchByTeamId(teamId))
        ])
            .pipe(
                map(([loadedEvent, teamSetting]) => {

                    const teamWorkspace = teamSetting.workspace;
                    const resourecLink = [ teamWorkspace, loadedEvent.link ].join('/');

                    return {
                        hostName,
                        inviteeName,
                        eventName: loadedEvent.name,
                        resourecLink,
                        additionalMessage
                    } as BookingRequest;
                }),
                mergeMap((bookingRequest) => {

                    const template = bookingRequest.additionalMessage
                        ? TextTemplate.BOOKING_REQUEST_POST_SCRIPT
                        : TextTemplate.BOOKING_REQUEST;

                    return this.sendMessage(
                        syncdayNotificationPublishKey,
                        {
                            template,
                            data: JSON.stringify(bookingRequest),
                            phoneNumber,
                            language
                        } as SyncdayAwsSnsRequest
                    );
                })
            );
    }

    async sendCancellationMessages(
        scheduledEventNotifications: ScheduledEventNotification[]
    ): Promise<boolean> {

        const notificationDataAndPublishKeyMap = new Map();
        const notificationDataAndPublishKeyArray = scheduledEventNotifications
            .filter((_scheduleNotification) => {
                const { notificationType } = _scheduleNotification;

                const isNotifcationTypeEmail = notificationType === NotificationType.EMAIL;
                const isNotDuplicated = notificationDataAndPublishKeyMap.has(notificationType) === false;

                if (isNotifcationTypeEmail && isNotDuplicated) {
                    notificationDataAndPublishKeyMap.set(notificationType, _scheduleNotification);
                }

                return isNotDuplicated;
            })
            .map((_scheduleNotification) => this.utilService.convertScheduleNotificationToNotificationDataAndPublishKey(_scheduleNotification));

        await Promise.all(
            notificationDataAndPublishKeyArray.map(
                ({
                    syncdayNotificationPublishKey,
                    notificationData
                }) => this.sendMessage(syncdayNotificationPublishKey, notificationData)
            )
        );

        return true;
    }

    sendMessage(
        syncdayNotificationPublishKey: SyncdayNotificationPublishKey,
        notificationData: SyncdayAwsSnsRequest
    ): Promise<boolean> {
        const messageAttribute: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify([syncdayNotificationPublishKey])
        };

        this.logger.info({
            message: 'Send message',
            syncdayNotificationPublishKey,
            notificationData
        });

        return this._sendNotification(messageAttribute, notificationData);
    }

    sendWelcomeEmailForNewUser(
        userName: string | null,
        userEmail: string,
        preferredLanguage: Language
    ): Promise<boolean> {
        const messageAttribute: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify([SyncdayNotificationPublishKey.EMAIL])
        };

        const notificationData = {
            template: EmailTemplate.WELCOME,
            email: userEmail,
            language: preferredLanguage,
            data: JSON.stringify({ userName })
        } as SyncdayAwsSnsRequest;

        return this._sendNotification(messageAttribute, notificationData);
    }

    async _sendNotification(
        messageAttribute: MessageAttributeValue,
        notificationData: SyncdayAwsSnsRequest
    ): Promise<boolean> {

        const params: PublishCommandInput = {
            Message: JSON.stringify(notificationData),
            TopicArn: AppConfigService.getAwsSnsTopicARNSyncdayNotification(this.configService),
            MessageAttributes: {
                notificationService: messageAttribute
            }
        };

        const response = await this.syncdayAwsSdkClientService
            .getSNSClient()
            .send(new PublishCommand(params));

        const isSuccess = response.$metadata.httpStatusCode === 200;

        return isSuccess;
    }
}
