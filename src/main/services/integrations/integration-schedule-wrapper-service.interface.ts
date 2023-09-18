import { IntegrationSchedulesService } from '@core/interfaces/integration-schedules.abstract-service';

export interface IntegrationScheduleWrapperService {
    getIntegrationSchedulesService(): IntegrationSchedulesService;
}
