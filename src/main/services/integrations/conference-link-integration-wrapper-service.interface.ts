import { ConferenceLinkIntegrationService } from '@core/interfaces/integrations/conference-link-integration.abstract-service';

export interface ConferenceLinkIntegrationWrapperService {
    getConferenceLinkIntegrationService(): ConferenceLinkIntegrationService;
}
