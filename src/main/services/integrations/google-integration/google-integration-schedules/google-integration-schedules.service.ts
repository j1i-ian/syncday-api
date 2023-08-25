import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { IntegrationSchedulesService } from '@core/interfaces/integration-schedules.service.interface';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';

@Injectable()
export class GoogleIntegrationSchedulesService implements IntegrationSchedulesService {

    async _saveAll(manager: EntityManager, googleSchdeduls: GoogleIntegrationSchedule[]): Promise<boolean> {

        const repository = manager.getRepository(GoogleIntegrationSchedule);

        await repository.save(googleSchdeduls, {
            reload: false
        });

        return true;
    }
}
