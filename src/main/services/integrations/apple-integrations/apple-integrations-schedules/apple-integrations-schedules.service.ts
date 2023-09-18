import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationSchedulesService } from '@core/interfaces/integration-schedules.abstract-service';
import { IntegrationSchedule } from '@entity/schedules/integration-schedule.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';

@Injectable()
export class AppleIntegrationsSchedulesService extends IntegrationSchedulesService {

    constructor(
        @InjectRepository(AppleCalDAVIntegrationSchedule) private readonly integrationScheduleRepository: Repository<AppleCalDAVIntegrationSchedule>
    ) {
        super();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _saveAll(_manager: EntityManager, _rawSchedules: IntegrationSchedule[]): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    getInjectedRepository(): Repository<IntegrationSchedule> {
        return this.integrationScheduleRepository;
    }
}
