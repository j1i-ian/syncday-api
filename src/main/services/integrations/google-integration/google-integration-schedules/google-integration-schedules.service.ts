import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationScheduledEventsService } from '@core/interfaces/integrations/integration-scheduled-events.abstract-service';
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

    getInjectedRepository(): Repository<IntegrationScheduledEvent> {
        return this.googleIntegrationScheduledEventsRepository;
    }
}
