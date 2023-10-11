import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { AppleIntegrationsService } from './apple-integrations.service';
import { AppleConverterService } from './apple-converter/apple-converter.service';
import { AppleIntegrationsSchedulesService } from './apple-integrations-schedules/apple-integrations-schedules.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([AppleCalDAVIntegration, AppleCalDAVIntegrationSchedule])
    ],
    providers: [AppleIntegrationsService, AppleConverterService, AppleIntegrationsSchedulesService],
    exports: [AppleIntegrationsService]
})
export class AppleIntegrationsModule {}
