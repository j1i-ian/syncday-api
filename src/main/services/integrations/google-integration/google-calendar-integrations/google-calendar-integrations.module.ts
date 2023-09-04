import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { GoogleCalendarEventWatchService } from '@services/integrations/google-integration/facades/google-calendar-event-watch.service';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegrationsController } from './google-calendar-integrations.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            GoogleIntegration,
            GoogleIntegrationSchedule,
            GoogleCalendarIntegration
        ]),
        ConfigModule
    ],
    providers: [
        GoogleConverterService,
        GoogleCalendarIntegrationsService,
        GoogleCalendarEventWatchService,
        IntegrationsRedisRepository
    ],
    exports: [GoogleCalendarIntegrationsService],
    controllers: [GoogleCalendarIntegrationsController]
})
export class GoogleCalendarIntegrationsModule {}
