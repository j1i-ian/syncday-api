import { IntegrationSchedulesService } from '@core/interfaces/integrations/integration-schedules.abstract-service';

export interface IntegrationScheduleWrapperService {
    getIntegrationSchedulesService(): IntegrationSchedulesService;
}
