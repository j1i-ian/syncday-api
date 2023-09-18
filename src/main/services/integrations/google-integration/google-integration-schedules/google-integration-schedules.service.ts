import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationSchedulesService } from '@core/interfaces/integration-schedules.abstract-service';
import { GoogleIntegrationSchedule } from '@entity/integrations/google/google-integration-schedule.entity';
import { IntegrationSchedule } from '@entity/schedules/integration-schedule.entity';

@Injectable()
export class GoogleIntegrationSchedulesService extends IntegrationSchedulesService {

    constructor(
        @InjectRepository(GoogleIntegrationSchedule) private readonly googleIntegrationScheduleRepository: Repository<GoogleIntegrationSchedule>
    ) {
        super();
    }

    async _saveAll(manager: EntityManager, googleSchdeduls: GoogleIntegrationSchedule[]): Promise<boolean> {

        const repository = manager.getRepository(GoogleIntegrationSchedule);

        await repository.save(googleSchdeduls, {
            reload: false
        });

        return true;
    }

    getInjectedRepository(): Repository<IntegrationSchedule> {
        return this.googleIntegrationScheduleRepository;
    }
}
