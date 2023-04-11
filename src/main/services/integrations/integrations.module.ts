import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleIntegration } from '../../../@core/core/entities/integrations/google/google-integration.entity';
import { GoogleIntegrationsService } from './google-integrations.service';
import { IntegrationsService } from './integrations.service';
import { CalendarsModule } from './calendars/calendars.module';
import { IntegrationsController } from './integrations.controller';

@Module({
    imports: [TypeOrmModule.forFeature([GoogleIntegration]), ConfigModule, CalendarsModule],
    controllers: [IntegrationsController],
    providers: [IntegrationsService, GoogleIntegrationsService],
    exports: [IntegrationsService, GoogleIntegrationsService]
})
export class IntegrationsModule {}
