import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';
import { CalendarIntegrationsModule } from '@services/integrations/calendar-integrations/calendar-integrations.module';
import { MeetingModule } from '@services/integrations/meetings/meetings.module';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([ GoogleIntegration, GoogleCalendarIntegration ]),
        MeetingModule,
        GoogleIntegrationModule,
        CalendarIntegrationsModule,
        ConfigModule
    ],
    controllers: [IntegrationsController],
    providers: [IntegrationsService, IntegrationsRedisRepository],
    exports: [IntegrationsService, IntegrationsRedisRepository]
})
export class IntegrationsModule {}
