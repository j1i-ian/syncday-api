import { CalendarIntegrationService } from '@core/interfaces/integrations/calendar-integration.abstract-service';

export interface CalendarIntegrationWrapperService {
    getCalendarIntegrationsService(): CalendarIntegrationService;
}
