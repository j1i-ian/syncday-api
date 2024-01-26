import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { GoogleCalendarEventWatchService } from '@services/integrations/google-integration/facades/google-calendar-event-watch.service';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { GoogleCalendarIntegration } from '@entities/integrations/google/google-calendar-integration.entity';
import { GoogleIntegrationScheduledEvent } from '@entities/integrations/google/google-integration-scheduled-event.entity';
import { GoogleIntegration } from '@entities/integrations/google/google-integration.entity';
import { IntegrationsRedisRepository } from '@repositories/integrations/integration-redis.repository';
import { GoogleCalendarIntegrationsController } from './google-calendar-integrations.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            GoogleIntegration,
            GoogleIntegrationScheduledEvent,
            GoogleCalendarIntegration
        ]),
        NotificationsModule
    ],
    providers: [
        GoogleCalendarIntegrationsService,
        GoogleCalendarEventWatchService,
        IntegrationsRedisRepository
    ],
    exports: [GoogleCalendarIntegrationsService],
    controllers: [GoogleCalendarIntegrationsController]
})
export class GoogleCalendarIntegrationsModule {}
