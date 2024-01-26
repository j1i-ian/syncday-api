import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';
import { CalendarIntegrationsModule } from '@services/integrations/calendar-integrations/calendar-integrations.module';
import { ZoomIntegrationsModule } from '@services/integrations/zoom-integrations/zoom-integrations.module';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { UserModule } from '@services/users/user.module';
import { IntegrationsController } from '@services/integrations/integrations.controller';
import { IntegrationsValidator } from '@services/integrations/integrations.validator';
import { GoogleIntegration } from '@entities/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entities/integrations/google/google-calendar-integration.entity';
import { IntegrationRedisModule } from '@repositories/integrations/integration-redis.module';
import { VendorIntegrationsController } from './vendor-integrations.controller';
import { AppleIntegrationsModule } from './apple-integrations/apple-integrations.module';
import { KakaotalkIntegrationsModule } from './kakaotalk-integrations/kakaotalk-integrations.module';

@Module({
    imports: [
        IntegrationRedisModule,
        TypeOrmModule.forFeature([ GoogleIntegration, GoogleCalendarIntegration ]),
        GoogleIntegrationModule,
        CalendarIntegrationsModule,
        ZoomIntegrationsModule,
        ConfigModule,
        forwardRef(() => UserModule),
        AppleIntegrationsModule,
        KakaotalkIntegrationsModule
    ],
    controllers: [
        IntegrationsController,
        VendorIntegrationsController
    ],
    providers: [
        JwtService,
        IntegrationsValidator,
        IntegrationsServiceLocator
    ],
    exports: [IntegrationsServiceLocator, IntegrationsValidator]
})
export class IntegrationsModule {}
