import { IntegrationScheduledEventsService } from '@interfaces/integrations/integration-scheduled-events.abstract-service';

export interface IntegrationScheduledEventsWrapperService {
    getIntegrationScheduledEventsService(): IntegrationScheduledEventsService;
}
