import { Observable, forkJoin, from, map, mergeMap } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { EventGroupSetting } from '@core/interfaces/event-groups/event-group-setting.interface';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { EventSetting } from '@interfaces/events/event-setting';
import { HostQuestion } from '@interfaces/events/event-details/host-question.interface';
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
            const _hostQuestionsKey = this.syncdayRedisService.getHostQuestionsKey(_eventDetailUUID);
            const _notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(_eventDetailUUID);
            const _eventSettingKey = this.syncdayRedisService.getEventSettingKey(_eventDetailUUID);

            readPipeline.get(_hostQuestionsKey);
            readPipeline.get(_notificationInfoKey);
            readPipeline.get(_eventSettingKey);
        });

        return from(
            readPipeline.exec() as Promise<Array<[unknown, HostQuestion[] | NotificationInfo | EventSetting]>>
        )
            .pipe(
                map((_results) => eventDetailUUIDs.reduce((eventDetailsRecord, _eventDetailUUID) => {
                    const [, _hostQuestions] = _results.shift() as [unknown, string];
                    const [, _notificationInfo] = _results.shift() as [unknown, string];
                    const [, _eventSetting] = _results.shift() as [unknown, string];

                    const _ensuredHostQuestions = JSON.parse(_hostQuestions || '[]');
                    const _ensuredNotificationInfo = JSON.parse(_notificationInfo || 'null');
                    const _ensuredEventSetting = JSON.parse(_eventSetting || 'null');

                    eventDetailsRecord[_eventDetailUUID] = {
                        hostQuestions: _ensuredHostQuestions,
                        notificationInfo: _ensuredNotificationInfo,
                        eventSetting: _ensuredEventSetting
                    };

                    return eventDetailsRecord;
                }, {} as EventDetailsRecord))
            );
    }

    getEventLinkStatus(workspace: string, link: string): Observable<boolean> {
        const eventLinkStatusKey = this.syncdayRedisService.getEventLinkStatusKey(workspace, link);

        return from(this.cluster.get(eventLinkStatusKey)).pipe(
            map((result) => {
                const isValidString = !!result && result !== '';
                const _ensuredResult = isValidString ? JSON.parse(result) as boolean: false;
                return _ensuredResult;
            })
        );
    }

    getHostQuestions(eventDetailUUID: string): Observable<HostQuestion[]> {
        const hostQuestionsKey = this.syncdayRedisService.getHostQuestionsKey(eventDetailUUID);

        return from(
            this.cluster.get(hostQuestionsKey)
        ).pipe(
            map((result) => {
                const isValidString = !!result && result !== '';
                const _ensuredHostQuestions = isValidString ? JSON.parse(result) as HostQuestion[] : [];
                return _ensuredHostQuestions;
            })
        );
    }

    getNotificationInfo(eventDetailUUID: string): Observable<NotificationInfo> {
        const notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID);

        return from(
            this.cluster.get(notificationInfoKey)
        ).pipe(
            map((result) => {
                const isValidString = !!result && result !== '';
                const _ensuredNotificationInfo = isValidString ? JSON.parse(result) as NotificationInfo : {};
                return _ensuredNotificationInfo;
            })
        );
    }

    getEventGroupSetting(eventGroupUUID: string): Observable<EventGroupSetting> {
        const eventGroupSettingKey = this.syncdayRedisService.getEventSettingKey(eventGroupUUID);

        return from(this.cluster.get(eventGroupSettingKey))
            .pipe(
                map((result) => {
                    const isValidString = !!result && result !== '';
                    const _ensuredEventSetting = isValidString ? JSON.parse(result) : {};
                    return _ensuredEventSetting as EventGroupSetting;
                })
            );
    }

    setEventGroupSetting(
        eventGroupUUID: string,
        eventGroupSetting: EventGroupSetting
    ): Observable<boolean> {
        const eventGroupSettingKey = this.syncdayRedisService.getEventSettingKey(eventGroupUUID);

        const eventGroupSettingBody = JSON.stringify(eventGroupSetting);

        return from(this.cluster.set(eventGroupSettingKey, eventGroupSettingBody))
            .pipe(
                map((result) => result === 'OK')
            );
    }

    getEventSetting(eventDetailUUID: string): Observable<EventSetting> {
        const eventSettingKey = this.syncdayRedisService.getEventSettingKey(eventDetailUUID);

        return from(
            this.cluster.get(eventSettingKey)
        ).pipe(
            map((result) => {
                const isValidString = !!result && result !== '';
                const _ensuredEventSetting = isValidString ? JSON.parse(result) : {};
                return _ensuredEventSetting as EventSetting;
            })
        );
    }

    async getEventLinkSetStatus(userUUID: string, eventLink: string): Promise<boolean> {
        const eventLinkSetStatusKey = this.syncdayRedisService.getEventLinkSetStatusKey(userUUID);
        const usedCount = await this.cluster.sismember(eventLinkSetStatusKey, eventLink);

        return usedCount > 0;
    }

    async setEventLinkSetStatus(userUUID: string, eventLink: string): Promise<boolean> {
        const eventLinkSetStatusKey = this.syncdayRedisService.getEventLinkSetStatusKey(userUUID);
        const addedItemCount = await this.cluster.sadd(eventLinkSetStatusKey, eventLink);

        return addedItemCount > 0;
    }

    async deleteEventLinkSetStatus(userUUID: string, eventLink: string): Promise<boolean> {
        const eventLinkSetStatusKey = this.syncdayRedisService.getEventLinkSetStatusKey(userUUID);
        const deletedItemCount = await this.cluster.srem(eventLinkSetStatusKey, eventLink);

        return deletedItemCount > 0;
    }

    /**
     * This method overwrites invitee questions, notification info always.
     * Both elements have too small chunk sizes, so it has not been configured with hash map
     *
     * @param eventDetailUUID
     * @param newHostQuestions
     * @param newNotificationInfo
     * @returns
     */
    async save(
        eventDetailUUID: string,
        newHostQuestions: HostQuestion[],
        newNotificationInfo: NotificationInfo,
        newEventSetting: EventSetting
    ): Promise<EventsDetailBody> {
        const hostQuestionKey = this.syncdayRedisService.getHostQuestionsKey(eventDetailUUID);
        const notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID);
        const eventSettingKey = this.syncdayRedisService.getEventSettingKey(eventDetailUUID);

        const newHostQuestionsBody = JSON.stringify(newHostQuestions);
        const createdHostQuestionsResult = await this.cluster.set(
            hostQuestionKey,
            newHostQuestionsBody
        );

        const newNotificationInfoBody = JSON.stringify(newNotificationInfo);
        const createdNotificationInfoResult = await this.cluster.set(notificationInfoKey, newNotificationInfoBody);

        const newEventSettingBody = JSON.stringify(newEventSetting);
        const createdEventSetting = await this.cluster.set(eventSettingKey, newEventSettingBody);

        if (
            createdHostQuestionsResult === 'OK'
            && createdNotificationInfoResult === 'OK'
            && createdEventSetting === 'OK') {
            return {
                hostQuestions: newHostQuestions,
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
            hostQuestions,
            notificationInfo,
            eventSetting
        } = eventDetailBody;

        const updatePipeline = this.cluster.pipeline();

        if (hostQuestions) {
            const hostQuestionKey = this.syncdayRedisService.getHostQuestionsKey(eventDetailUUID);

            const updateHostQuestionsBody = JSON.stringify(hostQuestions);
            updatePipeline.set(hostQuestionKey, updateHostQuestionsBody);
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
        const hostQuestionsKey = this.syncdayRedisService.getHostQuestionsKey(eventDetailUUID);
        const notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID);

        const deletedHostQuestionNode = await this.cluster.del(hostQuestionsKey);
        const deletedNotificationInfoNode = await this.cluster.del(notificationInfoKey);

        return deletedHostQuestionNode > 0 && deletedNotificationInfoNode > 0;
    }

    async removeEventDetails(eventDetailUUIDs: string[]): Promise<boolean> {

        const { hostQuestionKeys, notificationInfoKeys } =
            eventDetailUUIDs.reduce((hostQuestionAndNotificationInfoKeysArray, eventDetailUUID) =>  {
                const { hostQuestionKeys, notificationInfoKeys } = hostQuestionAndNotificationInfoKeysArray;
                hostQuestionKeys.push(this.syncdayRedisService.getHostQuestionsKey(eventDetailUUID));
                notificationInfoKeys.push(this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID));

                return { hostQuestionKeys, notificationInfoKeys };
            }, { hostQuestionKeys: [] as RedisKey[], notificationInfoKeys:[] as RedisKey[] });

        const deletePipeline = this.cluster.pipeline();

        hostQuestionKeys.forEach((hostQuestionKey) => deletePipeline.del(hostQuestionKey));
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
            sourceHostQuestions: this.getHostQuestions(sourceEventDetailUUID),
            sourceNotificationInfo: this.getNotificationInfo(sourceEventDetailUUID),
            sourceEventSetting: this.getEventSetting(sourceEventDetailUUID)
        }).pipe(
            mergeMap(({ sourceHostQuestions: sourceHostQuestions, sourceNotificationInfo, sourceEventSetting }) =>
                this.save(newEventDetailUUID, sourceHostQuestions, sourceNotificationInfo, sourceEventSetting)
            )
        );
    }
}
