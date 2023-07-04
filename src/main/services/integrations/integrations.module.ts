import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { IntegrationsService } from './integrations.service';
import { MeetingModule } from './meetings/meetings.module';
import { IntegrationsController } from './integrations.controller';
import { GoogleIntegrationModule } from './google-integration/google-integration.module';
import { CalendarIntegrationsModule } from './calendar-integrations/calendar-integrations.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([GoogleIntegration]),
        MeetingModule,
        GoogleIntegrationModule,
        CalendarIntegrationsModule,
        ConfigModule
    ],
    controllers: [IntegrationsController],
    providers: [IntegrationsService],
    exports: [IntegrationsService]
})
export class IntegrationsModule {}
