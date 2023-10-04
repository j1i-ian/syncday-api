import { Module } from '@nestjs/common';
import { AppleCalendarIntegrationsModule } from '@services/integrations/apple-integrations/apple-calendar-integrations/apple-calendar-integrations.module';
import { CalendarIntegrationsController } from '@services/integrations/calendar-integrations/calendar-integrations.controller';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { GoogleCalendarIntegrationsModule } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.module';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';

@Module({
    imports: [GoogleIntegrationModule, GoogleCalendarIntegrationsModule, AppleCalendarIntegrationsModule],
    controllers: [CalendarIntegrationsController],
    providers: [CalendarIntegrationsServiceLocator],
    exports: [CalendarIntegrationsServiceLocator]
})
export class CalendarIntegrationsModule {}
