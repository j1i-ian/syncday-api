import { Injectable } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, from } from 'rxjs';
import { IntegrationScheduledEventsService } from '@core/interfaces/integrations/integration-scheduled-events.abstract-service';
import { InviteeScheduledEvent } from '@core/interfaces/scheduled-events/invitee-scheduled-events.interface';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { AppleCalDAVIntegrationScheduledEvent } from '@entity/integrations/apple/apple-caldav-integration-scheduled-event.entity';
import { IntegrationScheduledEvent } from '@entity/scheduled-events/integration-scheduled-event.entity';

@Injectable()
export class AppleIntegrationsSchedulesService extends IntegrationScheduledEventsService {

    constructor(
        @InjectRepository(AppleCalDAVIntegrationScheduledEvent) private readonly integrationScheduleRepository: Repository<AppleCalDAVIntegrationScheduledEvent>
    ) {
        super();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _saveAll(_manager: EntityManager, _rawSchedules: IntegrationScheduledEvent[]): Promise<boolean> {
        throw new Error('Method not implemented.');
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
            appleCalDAVCalendarIntegration: {
                appleCalDAVIntegration: {
                    profile: {
                        eventProfiles: {
                            event: {
                                uuid: eventUUID
                            }
                        }
                    }
                }
            }
        } as FindOptionsWhere<AppleCalDAVIntegrationScheduledEvent>;

        return from(this.integrationScheduleRepository.find({
            relations: {
                appleCalDAVCalendarIntegration: {
                    appleCalDAVIntegration: {
                        profile: {
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
        return this.integrationScheduleRepository;
    }
}
