import { EntityManager } from 'typeorm';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';

export interface IntegrationSchedulesService {

    _saveAll(manager: EntityManager, rawSchedules: GoogleIntegrationSchedule[]): Promise<boolean>;
}
