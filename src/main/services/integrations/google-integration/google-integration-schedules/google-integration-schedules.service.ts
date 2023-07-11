import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { IntegrationSchedulesService } from '@app/interfaces/integrations/integration-schedules.service.interface';

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
