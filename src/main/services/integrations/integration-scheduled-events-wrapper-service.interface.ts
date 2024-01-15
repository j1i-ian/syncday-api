import { IntegrationScheduledEventsService } from '@core/interfaces/integrations/integration-scheduled-events.abstract-service';

export interface IntegrationScheduledEventsWrapperService {
    getIntegrationScheduledEventsService(): IntegrationScheduledEventsService;
}
