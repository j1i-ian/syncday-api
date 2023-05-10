import { Observable, from, iif, of, switchMap } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { InviteeQuestion } from '@core/entities/invitee-questions/invitee-question.entity';
import { Reminder } from '@core/entities/reminders/reminder.entity';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsDetailBody } from '@app/interfaces/events/events-detail-body.interface';
import { InviteeQuestionsOrRemindersSaveFailException } from '@app/exceptions/invitee-questions-or-reminders-save-fail.exception';

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

    getInviteeQuestions(eventDetailUUID: string): Observable<InviteeQuestion[]> {
        const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID);

        return from(this.cluster.get(inviteeQuestionKey)).pipe(
            switchMap((result: string | null) =>
                iif(() => !!result, of(JSON.parse(result as string) as InviteeQuestion[]), of([]))
            )
        );
    }

    getReminders(eventDetailUUID: string): Observable<Reminder[]> {
        const reminderKey = this.syncdayRedisService.getRemindersKey(eventDetailUUID);

        return from(this.cluster.get(reminderKey)).pipe(
            switchMap((result: string | null) =>
                iif(() => !!result, of(JSON.parse(result as string) as Reminder[]), of([]))
            )
        );
    }

    /**
     * This method overwrites invitee questions, reminders always.
     * Both elements have too small chunk sizes, so it has not been configured with hash map
     *
     * @param eventDetailUUID
     * @param newInviteeQuestions
     * @param newReminders
     * @returns
     */
    async save(
        eventDetailUUID: string,
        newInviteeQuestions: InviteeQuestion[],
        newReminders: Reminder[]
    ): Promise<EventsDetailBody> {
        const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID);
        const reminderKey = this.syncdayRedisService.getRemindersKey(eventDetailUUID);

        const newInviteeQuestionsBody = JSON.stringify(newInviteeQuestions);
        const createdInviteeQuestionsResult = await this.cluster.set(
            inviteeQuestionKey,
            newInviteeQuestionsBody
        );

        const newRemindersBody = JSON.stringify(newReminders);
        const createdRemindersResult = await this.cluster.set(reminderKey, newRemindersBody);

        if (createdInviteeQuestionsResult === 'OK' && createdRemindersResult === 'OK') {
            return {
                inviteeQuestions: newInviteeQuestions,
                reminders: newReminders
            };
        } else {
            throw new InviteeQuestionsOrRemindersSaveFailException();
        }
    }

    async remove(eventDetailUUID: string): Promise<boolean> {
        const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(eventDetailUUID);
        const reminderKey = this.syncdayRedisService.getRemindersKey(eventDetailUUID);

        const deletedInviteeQuestionNode = await this.cluster.del(inviteeQuestionKey);
        const deletedReminderNode = await this.cluster.del(reminderKey);

        return deletedInviteeQuestionNode > 0 && deletedReminderNode > 0;
    }
}
