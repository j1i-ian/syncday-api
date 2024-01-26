import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppleCalendarIntegrationsService } from '@services/integrations/apple-integrations/apple-calendar-integrations/apple-calendar-integrations.service';
import { AppleIntegrationFacadeModule } from '@services/integrations/apple-integrations/facades/apple-integration-facade.module';
import { AppleCalDAVCalendarIntegration } from '@entities/integrations/apple/apple-caldav-calendar-integration.entity';
import { AppleCalDAVIntegration } from '@entities/integrations/apple/apple-caldav-integration.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AppleCalDAVIntegration,
            AppleCalDAVCalendarIntegration
        ]),
        AppleIntegrationFacadeModule
    ],
    providers: [
        AppleCalendarIntegrationsService
    ],
    exports: [
        AppleCalendarIntegrationsService
    ]
})
export class AppleCalendarIntegrationsModule {}
