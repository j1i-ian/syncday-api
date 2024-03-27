import { Injectable } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, from } from 'rxjs';
import { IntegrationScheduledEventsService } from '@core/interfaces/integrations/integration-scheduled-events.abstract-service';
import { InviteeScheduledEvent } from '@core/interfaces/scheduled-events/invitee-scheduled-events.interface';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { GoogleIntegrationScheduledEvent } from '@entity/integrations/google/google-integration-scheduled-event.entity';
import { IntegrationScheduledEvent } from '@entity/scheduled-events/integration-scheduled-event.entity';

@Injectable()
export class GoogleIntegrationSchedulesService extends IntegrationScheduledEventsService {

    constructor(
        @InjectRepository(GoogleIntegrationScheduledEvent) private readonly googleIntegrationScheduledEventsRepository: Repository<GoogleIntegrationScheduledEvent>
    ) {
        super();
    }

    async _saveAll(manager: EntityManager, googleSchdeduledEvents: GoogleIntegrationScheduledEvent[]): Promise<boolean> {

        const repository = manager.getRepository(GoogleIntegrationScheduledEvent);

        await repository.save(googleSchdeduledEvents, {
            reload: false
        });

        return true;
    }

    search(scheduledEventsSearchOption: Partial<ScheduledEventSearchOption>): Observable<InviteeScheduledEvent[]> {

        const {
            eventUUID,
            page,
            take,
            since,
            until
        } = scheduledEventsSearchOption;

        const defaultUntilDateTime = new Date(new Date().getDate() + 90);
        const ensuredSinceDateTime = since ? new Date(since) : new Date();
        const ensuredUntilDateTime = until ? new Date(until) : defaultUntilDateTime;

        const ensuredTake = take ? take : undefined;
        const skip = page && take ? page * take : 0;

        const profileOrEventUUIDConditions = {
            googleCalendarIntegration: {
                googleIntegration: {
                    profiles: {
                        eventProfiles: {
                            event: {
                                uuid: eventUUID
                            }
                        }
                    }
                }
            }
        } as FindOptionsWhere<GoogleIntegrationScheduledEvent>;

        return from(this.googleIntegrationScheduledEventsRepository.find({
            relations: {
                googleCalendarIntegration: {
                    googleIntegration: {
                        profiles: {
                            eventProfiles: {
                                event: true
                            }
                        }
                    }
                }
            },
            where: [
                {
                    scheduledTime: {
                        startTimestamp: MoreThanOrEqual(ensuredSinceDateTime),
                        endTimestamp: LessThanOrEqual(ensuredUntilDateTime)
                    },
                    ...profileOrEventUUIDConditions
                },
                {
                    scheduledBufferTime: {
                        startBufferTimestamp: MoreThanOrEqual(ensuredSinceDateTime),
                        endBufferTimestamp: LessThanOrEqual(ensuredUntilDateTime)
                    },
                    ...profileOrEventUUIDConditions
                }
            ],
            skip,
            take: ensuredTake
        }));
    }

    getInjectedRepository(): Repository<IntegrationScheduledEvent> {
        return this.googleIntegrationScheduledEventsRepository;
    }
}
