import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationScheduledEventsService } from '@interfaces/integrations/integration-scheduled-events.abstract-service';
import { AppleCalDAVIntegrationScheduledEvent } from '@entities/integrations/apple/apple-caldav-integration-scheduled-event.entity';
import { IntegrationScheduledEvent } from '@entities/scheduled-events/integration-scheduled-event.entity';

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

    getInjectedRepository(): Repository<IntegrationScheduledEvent> {
        return this.integrationScheduleRepository;
    }
}
