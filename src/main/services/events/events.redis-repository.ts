import { Observable, forkJoin, from, iif, mergeMap, of, switchMap } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { InviteeQuestion } from '@core/entities/invitee-questions/invitee-question.entity';
import { NotificationInfo } from '@interfaces/notifications/notification-info.interface';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsDetailBody } from '@app/interfaces/events/events-detail-body.interface';
import { EventDetailBodySaveFailException } from '@app/exceptions/event-detail-body-save-fail.exception';

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
        newNotificationInfo: NotificationInfo
    ): Promise<EventsDetailBody> {
        const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID);
        const notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID);

        const newInviteeQuestionsBody = JSON.stringify(newInviteeQuestions);
        const createdInviteeQuestionsResult = await this.cluster.set(
            inviteeQuestionKey,
            newInviteeQuestionsBody
        );

        const newNotificationInfoBody = JSON.stringify(newNotificationInfo);
        const createdNotificationInfoResult = await this.cluster.set(notificationInfoKey, newNotificationInfoBody);

        if (createdInviteeQuestionsResult === 'OK' && createdNotificationInfoResult === 'OK') {
            return {
                inviteeQuestions: newInviteeQuestions,
                notificationInfo: newNotificationInfo
            };
        } else {
            throw new EventDetailBodySaveFailException();
        }
    }

    async remove(eventDetailUUID: string): Promise<boolean> {
        const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID);
        const notificationInfoKey = this.syncdayRedisService.getNotificationInfoKey(eventDetailUUID);

        const deletedInviteeQuestionNode = await this.cluster.del(inviteeQuestionKey);
        const deletedNotificationInfoNode = await this.cluster.del(notificationInfoKey);

        return deletedInviteeQuestionNode > 0 && deletedNotificationInfoNode > 0;
    }

    clone(sourceEventDetailUUID: string, newEventDetailUUID: string): Observable<EventsDetailBody> {
        return forkJoin({
            sourceInviteeQuestions: this.getInviteeQuestions(sourceEventDetailUUID),
            sourceNotificationInfo: this.getNotificationInfo(sourceEventDetailUUID)
        }).pipe(
            switchMap(({ sourceInviteeQuestions, sourceNotificationInfo }) =>
                this.save(newEventDetailUUID, sourceInviteeQuestions, sourceNotificationInfo)
            )
        );
    }
}
