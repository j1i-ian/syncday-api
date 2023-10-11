import { Module } from '@nestjs/common';
import { CalendarIntegrationsController } from '@services/integrations/calendar-integrations/calendar-integrations.controller';
import { GoogleCalendarIntegrationsModule } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.module';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';

@Module({
    imports: [GoogleIntegrationModule, GoogleCalendarIntegrationsModule],
    controllers: [CalendarIntegrationsController]
})
export class CalendarIntegrationsModule {}
