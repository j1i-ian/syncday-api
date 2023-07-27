import { Observable, forkJoin, from, iif, map, mergeMap, of } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { InviteeQuestion } from '@core/entities/invitee-questions/invitee-question.entity';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { EventSetting } from '@interfaces/events/event-setting';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsDetailBody } from '@app/interfaces/events/events-detail-body.interface';
import { EventDetailBodySaveFailException } from '@app/exceptions/event-detail-body-save-fail.exception';

interface EventDetailsRecord {
    [eventDetailUUID: string]: EventsDetailBody;
}

/**
 * TODO: modulization to NessJS-Typeorm or custom repository that can be loaded with getRepositoryToken() in typeorm.
 *
 * This repository should be binded with NestJS-Typeorm module or Customizing.
 * but I have no time for study for MVP release.
 */
@Injectable()
export class EventsRedisRepository {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    getEventDetailRecords(eventDetailUUIDs: string[]): Observable<EventDetailsRecord> {
        const readPipeline = this.cluster.pipeline();

        // 키들의 값을 가져오기 위한 파이프라인 명령 추가
        eventDetailUUIDs.forEach((_eventDetailUUID) => {
            const _inviteeQuestionsKey = this.syncdayRedisService.getInviteeQuestionKey(_eventDetailUUID);
            const _notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(_eventDetailUUID);
            const _eventSettingKey = this.syncdayRedisService.getEventSettingKey(_eventDetailUUID);

            readPipeline.get(_inviteeQuestionsKey);
            readPipeline.get(_notificationInfoKey);
            readPipeline.get(_eventSettingKey);
        });

        return from(readPipeline.exec() as Promise<Array<[unknown, InviteeQuestion[] | NotificationInfo | EventSetting]>>)
            .pipe(
                map((_results) => eventDetailUUIDs.reduce((eventDetailsRecord, _eventDetailUUID) => {
                    const [, _inviteeQuestions] = _results.shift() as [unknown, string];
                    const [, _notificationInfo] = _results.shift() as [unknown, string];
                    const [, _eventSetting] = _results.shift() as [unknown, string];

                    eventDetailsRecord[_eventDetailUUID] = {
                        inviteeQuestions: JSON.parse(_inviteeQuestions),
                        notificationInfo: JSON.parse(_notificationInfo),
                        eventSetting: JSON.parse(_eventSetting)
                    };

                    return eventDetailsRecord;
                }, {} as EventDetailsRecord))
            );
    }

    getEventLinkStatus(workspace: string, link: string): Observable<boolean> {
        const eventLinkStatusKey = this.syncdayRedisService.getEventLinkStatusKey(workspace, link);

        return from(this.cluster.get(eventLinkStatusKey)).pipe(
            mergeMap((result: string | null) =>
                iif(() => !!result, of(JSON.parse(result as string) as boolean), of(false))
            )
        );
    }

    getInviteeQuestions(eventDetailUUID: string): Observable<InviteeQuestion[]> {
        const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID);

        return from(this.cluster.get(inviteeQuestionKey)).pipe(
            mergeMap((result: string | null) =>
                iif(() => !!result, of(JSON.parse(result as string) as InviteeQuestion[]), of([]))
            )
        );
    }

    getNotificationInfo(eventDetailUUID: string): Observable<NotificationInfo> {
        const notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID);

        return from(this.cluster.get(notificationInfoKey)).pipe(
            mergeMap((result: string | null) =>
                iif(() => !!result, of(JSON.parse(result as string) as NotificationInfo), of({}))
            )
        );
    }

    getEventSetting(eventDetailUUID: string): Observable<EventSetting> {
        const eventSettingKey = this.syncdayRedisService.getEventSettingKey(eventDetailUUID);

        return from(this.cluster.get(eventSettingKey)).pipe(
            mergeMap((result: string | null) =>
                iif(() => !!result, of(JSON.parse(result as string) as EventSetting), of({} as EventSetting))
            )
        );
    }

    async getEventLinkSetStatus(userUUID: string, eventName: string): Promise<boolean> {
        const eventLinkSetStatusKey = this.syncdayRedisService.getEventLinkSetStatusKey(userUUID);
        const usedCount = await this.cluster.sismember(eventLinkSetStatusKey, eventName);

        return usedCount > 0;
    }

    async setEventLinkSetStatus(userUUID: string, eventName: string): Promise<boolean> {
        const eventLinkSetStatusKey = this.syncdayRedisService.getEventLinkSetStatusKey(userUUID);
        const addedItemCount = await this.cluster.sadd(eventLinkSetStatusKey, eventName);

        return addedItemCount > 0;
    }

    /**
     * This method overwrites invitee questions, notification info always.
     * Both elements have too small chunk sizes, so it has not been configured with hash map
     *
     * @param eventDetailUUID
     * @param newInviteeQuestions
     * @param newNotificationInfo
     * @returns
     */
    async save(
        eventDetailUUID: string,
        newInviteeQuestions: InviteeQuestion[],
        newNotificationInfo: NotificationInfo,
        newEventSetting: EventSetting
    ): Promise<EventsDetailBody> {
        const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID);
        const notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID);
        const eventSettingKey = this.syncdayRedisService.getEventSettingKey(eventDetailUUID);

        const newInviteeQuestionsBody = JSON.stringify(newInviteeQuestions);
        const createdInviteeQuestionsResult = await this.cluster.set(
            inviteeQuestionKey,
            newInviteeQuestionsBody
        );

        const newNotificationInfoBody = JSON.stringify(newNotificationInfo);
        const createdNotificationInfoResult = await this.cluster.set(notificationInfoKey, newNotificationInfoBody);

        const newEventSettingBody = JSON.stringify(newEventSetting);
        const createdEventSetting = await this.cluster.set(eventSettingKey, newEventSettingBody);

        if (
            createdInviteeQuestionsResult === 'OK'
            && createdNotificationInfoResult === 'OK'
            && createdEventSetting === 'OK') {
            return {
                inviteeQuestions: newInviteeQuestions,
                notificationInfo: newNotificationInfo,
                eventSetting: newEventSetting
            };
        } else {
            throw new EventDetailBodySaveFailException();
        }
    }

    async updateEventDetailBody(
        eventDetailUUID: string,
        eventDetailBody: Partial<EventsDetailBody>
    ): Promise<boolean> {

        const {
            inviteeQuestions,
            notificationInfo,
            eventSetting
        } = eventDetailBody;

        const updatePipeline = this.cluster.pipeline();

        if (inviteeQuestions) {
            const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID);

            const updateInviteeQuestionsBody = JSON.stringify(inviteeQuestions);
            updatePipeline.set(inviteeQuestionKey, updateInviteeQuestionsBody);
        }

        if (notificationInfo) {
            const notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID);

            const updateNotificationInfoBody = JSON.stringify(notificationInfo);
            updatePipeline.set(notificationInfoKey, updateNotificationInfoBody);
        }

        if (eventSetting) {
            const eventSettingKey = this.syncdayRedisService.getEventSettingKey(eventDetailUUID);

            const updateEventSettingsBody = JSON.stringify(eventSetting);
            updatePipeline.set(eventSettingKey, updateEventSettingsBody);
        }

        await updatePipeline.exec();

        return true;
    }

    async remove(eventDetailUUID: string): Promise<boolean> {
        const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID);
        const notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID);

        const deletedInviteeQuestionNode = await this.cluster.del(inviteeQuestionKey);
        const deletedNotificationInfoNode = await this.cluster.del(notificationInfoKey);

        return deletedInviteeQuestionNode > 0 && deletedNotificationInfoNode > 0;
    }

    async removeEventDetails(eventDetailUUIDs: string[]): Promise<boolean> {

        const { inviteeQuestionKeys, notificationInfoKeys } =
            eventDetailUUIDs.reduce((inviteeQuestionAndNotificationInfoKeysArray, eventDetailUUID) =>  {
                const { inviteeQuestionKeys, notificationInfoKeys } = inviteeQuestionAndNotificationInfoKeysArray;
                inviteeQuestionKeys.push(this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID));
                notificationInfoKeys.push(this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID));

                return { inviteeQuestionKeys, notificationInfoKeys };
            }, { inviteeQuestionKeys: [] as RedisKey[], notificationInfoKeys:[] as RedisKey[] });

        const deletePipeline = this.cluster.pipeline();

        inviteeQuestionKeys.forEach((inviteeQuestionKey) => deletePipeline.del(inviteeQuestionKey));
        notificationInfoKeys.forEach((notificationInfoKey) => deletePipeline.del(notificationInfoKey));

        const results = await deletePipeline.exec();

        let deleteSuccess = false;

        if (results) {
            // Need to check result.
            deleteSuccess = results.every(([, result]) => result === 1);
        }

        return deleteSuccess;
    }

    clone(sourceEventDetailUUID: string, newEventDetailUUID: string): Observable<EventsDetailBody> {
        return forkJoin({
            sourceInviteeQuestions: this.getInviteeQuestions(sourceEventDetailUUID),
            sourceNotificationInfo: this.getNotificationInfo(sourceEventDetailUUID),
            sourceEventSetting: this.getEventSetting(sourceEventDetailUUID)
        }).pipe(
            mergeMap(({ sourceInviteeQuestions, sourceNotificationInfo, sourceEventSetting }) =>
                this.save(newEventDetailUUID, sourceInviteeQuestions, sourceNotificationInfo, sourceEventSetting)
            )
        );
    }
}
