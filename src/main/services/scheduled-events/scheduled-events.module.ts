import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledEventsRedisRepository } from '@services/scheduled-events/scheduled-events.redis-repository';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { EventsModule } from '@services/events/events.module';
import { GoogleCalendarIntegrationsModule } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.module';
import { AvailabilityModule } from '@services/availability/availability.module';
import { IntegrationsModule } from '@services/integrations/integrations.module';
import { NativeScheduledEventsService } from '@services/scheduled-events/native-scheduled-events.service';
import { CalendarIntegrationsModule } from '@services/integrations/calendar-integrations/calendar-integrations.module';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { GoogleIntegrationScheduledEvent } from '@entity/integrations/google/google-integration-scheduled-event.entity';
import { AppleCalDAVIntegrationScheduledEvent } from '@entity/integrations/apple/apple-caldav-integration-scheduled-event.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { GlobalScheduledEventsService } from './global-scheduled-events.service';
import { ScheduledEventsController } from './scheduled-events.controller';

@Module({
    controllers: [ScheduledEventsController],
    imports: [
        TypeOrmModule.forFeature([ScheduledEvent, GoogleIntegrationScheduledEvent, AppleCalDAVIntegrationScheduledEvent]),
        SyncdayRedisModule,
        GoogleCalendarIntegrationsModule,
        EventsModule,
        AvailabilityModule,
        IntegrationsModule,
        CalendarIntegrationsModule,
        NotificationsModule
    ],
    providers: [GlobalScheduledEventsService, NativeScheduledEventsService, ScheduledEventsRedisRepository],
    exports: [GlobalScheduledEventsService, ScheduledEventsRedisRepository]
})
export class ScheduledEventsModule {}
