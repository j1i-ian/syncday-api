import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleIntegration } from '../../../@core/core/entities/integrations/google/google-integration.entity';
import { GoogleIntegrationsService } from './google-integrations.service';
import { IntegrationsService } from './integrations.service';

@Module({
    imports: [ConfigModule, TypeOrmModule.forFeature([GoogleIntegration])],
    providers: [IntegrationsService, GoogleIntegrationsService],
    exports: [IntegrationsService, GoogleIntegrationsService]
})
export class IntegrationsModule {}
