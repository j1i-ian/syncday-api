import { CalendarIntegrationService } from '@interfaces/integrations/calendar-integration.abstract-service';

export interface CalendarIntegrationWrapperService {
    getCalendarIntegrationsService(): CalendarIntegrationService;
}
