import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppleIntegrationFacadeModule } from '@services/integrations/apple-integrations/facades/apple-integration-facade.module';
import { AppleCalDAVIntegration } from '@entities/integrations/apple/apple-caldav-integration.entity';
import { AppleCalDAVIntegrationScheduledEvent } from '@entities/integrations/apple/apple-caldav-integration-scheduled-event.entity';
import { AppleIntegrationsService } from './apple-integrations.service';
import { AppleIntegrationsSchedulesService } from './apple-integrations-schedules/apple-integrations-schedules.service';
import { AppleCalendarIntegrationsModule } from './apple-calendar-integrations/apple-calendar-integrations.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([AppleCalDAVIntegration, AppleCalDAVIntegrationScheduledEvent]),
        AppleCalendarIntegrationsModule,
        AppleIntegrationFacadeModule
    ],
    providers: [
        AppleIntegrationsService,
        AppleIntegrationsSchedulesService
    ],
    exports: [AppleIntegrationsService]
})
export class AppleIntegrationsModule {}
