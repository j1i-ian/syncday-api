import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppleConverterService } from '@services/integrations/apple-integrations/apple-converter/apple-converter.service';
import { AppleCalendarIntegrationsService } from '@services/integrations/apple-integrations/apple-calendar-integrations/apple-calendar-integrations.service';
import { AppleIntegrationFacadeModule } from '@services/integrations/apple-integrations/facades/apple-integration-facade.module';
import { AppleCalDAVCalendarIntegration } from '@entity/integrations/apple/apple-caldav-calendar-integration.entity';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AppleCalDAVIntegration,
            AppleCalDAVCalendarIntegration
        ]),
        AppleIntegrationFacadeModule
    ],
    providers: [
        AppleConverterService,
        AppleCalendarIntegrationsService
    ],
    exports: [
        AppleCalendarIntegrationsService
    ]
})
export class AppleCalendarIntegrationsModule {}
