import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';
import { CalendarIntegrationsModule } from '@services/integrations/calendar-integrations/calendar-integrations.module';
import { ZoomIntegrationsModule } from '@services/integrations/zoom-integrations/zoom-integrations.module';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { UserModule } from '@services/users/user.module';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([ GoogleIntegration, GoogleCalendarIntegration ]),
        GoogleIntegrationModule,
        CalendarIntegrationsModule,
        ZoomIntegrationsModule,
        ConfigModule,
        forwardRef(() => UserModule)
    ],
    controllers: [IntegrationsController],
    providers: [
        JwtService,
        IntegrationsServiceLocator,
        IntegrationsService,
        IntegrationsRedisRepository
    ],
    exports: [IntegrationsServiceLocator, IntegrationsService, IntegrationsRedisRepository]
})
export class IntegrationsModule {}
