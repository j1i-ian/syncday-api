import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, combineLatest, from, map, mergeMap } from 'rxjs';
import { MessageAttributeValue, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { SyncdayAwsSnsRequest } from '@core/interfaces/notifications/syncday-aws-sns-request.interface';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { BookingRequest } from '@core/interfaces/notifications/text-templates/booking-request.interface';
import { TextTemplate } from '@core/interfaces/notifications/text-template.enum';
import { AppConfigService } from '@config/app-config.service';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { ReminderType } from '@interfaces/reminders/reminder-type.enum';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { ScheduledEventNotification } from '@entity/schedules/scheduled-event-notification.entity';
import { Language } from '@app/enums/language.enum';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly utilService: UtilService,
        private readonly eventsService: EventsService,
        private readonly teamSettingService: TeamSettingService,
        private readonly configService: ConfigService,
        private readonly syncdayAwsSdkClientService: SyncdayAwsSdkClientService
    ) {}

    sendBookingRequest(
        teamId: number,
        eventId: number,
        hostName: string,
        inviteeName: string,
        phoneNumber: string,
        memo?: string
    ): Observable<boolean> {

        const reminderType = ReminderType.KAKAOTALK;
        const conditionalSentence = memo ? ' 님의 메시지 :' : '';
        const syncdayNotificationPublishKey = this.utilService.convertReminderTypeToSyncdayNotificationPublishKey(reminderType);

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
                        userName: inviteeName,
                        eventName: loadedEvent.name,
                        eventUrl: resourecLink,
                        conditionalSentence,
                        additionalMessage: memo
                    } as BookingRequest;
                }),
                mergeMap((bookingRequest) =>
                    this.sendMessage(
                        syncdayNotificationPublishKey,
                        {
                            template: TextTemplate.BOOKING_REQUEST,
                            data: JSON.stringify(bookingRequest),
                            phoneNumber
                        }
                    )
                )
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

    async sendMessage(
        syncdayNotificationPublishKey: SyncdayNotificationPublishKey,
        notificationData: SyncdayAwsSnsRequest
    ): Promise<boolean> {
        const messageAttribute: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify([syncdayNotificationPublishKey])
        };

        return await this._sendNotification(messageAttribute, notificationData);
    }

    async sendWelcomeEmailForNewUser(userName: string, userEmail: string, preferredLanguage: Language): Promise<boolean> {
        const messageAttribute: MessageAttributeValue = {
            DataType: 'String.Array',
            StringValue: JSON.stringify([SyncdayNotificationPublishKey.EMAIL])
        };

        const notificationData = {
            template: EmailTemplate.WELCOME,
            recipient: userEmail,
            language: preferredLanguage,
            data: JSON.stringify({ userName })
        } as SyncdayAwsSnsRequest;

        return await this._sendNotification(messageAttribute, notificationData);
    }

    async _sendNotification(messageAttribute: MessageAttributeValue, notificationData: SyncdayAwsSnsRequest): Promise<boolean> {
        const params: PublishCommandInput = {
            Message: JSON.stringify(notificationData),
            TopicArn: AppConfigService.getAwsSnsTopicARNSyncdayNotification(this.configService),
            MessageAttributes: {
                notificationService: messageAttribute
            }
        };

        const response = await this.syncdayAwsSdkClientService.getSNSClient().send(new PublishCommand(params));

        const isSuccess = response.$metadata.httpStatusCode === 200;

        return isSuccess;
    }
}
