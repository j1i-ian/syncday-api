import { Module } from '@nestjs/common';
import { CalendarIntegrationsController } from '@services/integrations/calendar-integrations/calendar-integrations.controller';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';

@Module({
    imports: [GoogleIntegrationModule],
    controllers: [CalendarIntegrationsController]
})
export class CalendarIntegrationsModule {}
