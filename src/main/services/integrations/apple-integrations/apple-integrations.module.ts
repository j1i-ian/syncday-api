import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppleIntegrationFacadeModule } from '@services/integrations/apple-integrations/facades/apple-integration-facade.module';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { AppleIntegrationsService } from './apple-integrations.service';
import { AppleConverterService } from './apple-converter/apple-converter.service';
import { AppleIntegrationsSchedulesService } from './apple-integrations-schedules/apple-integrations-schedules.service';
import { AppleCalendarIntegrationsModule } from './apple-calendar-integrations/apple-calendar-integrations.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([AppleCalDAVIntegration, AppleCalDAVIntegrationSchedule]),
        AppleCalendarIntegrationsModule,
        AppleIntegrationFacadeModule
    ],
    providers: [
        AppleIntegrationsService,
        AppleConverterService,
        AppleIntegrationsSchedulesService
    ],
    exports: [AppleIntegrationsService]
})
export class AppleIntegrationsModule {}