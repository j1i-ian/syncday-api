import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { EventsModule } from '@services/events/events.module';
import { GoogleCalendarIntegrationsModule } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.module';
import { AvailabilityModule } from '@services/availability/availability.module';
import { IntegrationsModule } from '@services/integrations/integrations.module';
import { NativeSchedulesService } from '@services/schedules/native-schedules.service';
import { CalendarIntegrationsModule } from '@services/integrations/calendar-integrations/calendar-integrations.module';
import { Schedule } from '@entity/schedules/schedule.entity';
import { GoogleIntegrationSchedule } from '@entity/integrations/google/google-integration-schedule.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { GlobalSchedulesService } from './global-schedules.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Schedule, GoogleIntegrationSchedule, AppleCalDAVIntegrationSchedule]),
        SyncdayRedisModule,
        GoogleCalendarIntegrationsModule,
        EventsModule,
        AvailabilityModule,
        IntegrationsModule,
        CalendarIntegrationsModule
    ],
    providers: [GlobalSchedulesService, NativeSchedulesService, SchedulesRedisRepository],
    exports: [GlobalSchedulesService, SchedulesRedisRepository]
})
export class SchedulesModule {}
