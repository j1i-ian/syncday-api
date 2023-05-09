import { Observable, from, iif, of, switchMap } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { InviteeQuestion } from '@core/entities/invitee-questions/invitee-question.entity';
import { Reminder } from '@core/entities/reminders/reminder.entity';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';

/**
 * TODO: modulization to NessJS-Typeorm or custom repository that can be loaded with getRepositoryToken() in typeorm.
 *
 * This repository should be binded with NestJS-Typeorm module or Customizing.
 * but I have no time for study for MVP release.
 */
@Injectable()
export class EventRedisRepository {
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
}
