import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleOAuthClientService } from '@services/integrations/google-integration/facades/google-oauth-client.service';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleOAuthUserService } from '@services/integrations/google-integration/facades/google-oauth-user.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleOAuthTokenService } from './facades/google-oauth-token.service';
import { GoogleCalendarListService } from './facades/google-calendar-list.service';
import { GoogleConverterService } from './google-converter/google-converter.service';
import { GoogleCalendarIntegrationsService } from './google-calendar-integrations/google-calendar-integrations.service';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([GoogleCalendarIntegration, GoogleIntegration])
    ],
    providers: [
        GoogleIntegrationFacade,
        GoogleOAuthClientService,
        GoogleOAuthTokenService,
        GoogleOAuthUserService,
        GoogleCalendarListService,
        GoogleConverterService,

        GoogleCalendarIntegrationsService,
        GoogleIntegrationsService
    ],
    exports: [GoogleIntegrationFacade, GoogleConverterService, GoogleCalendarIntegrationsService, GoogleIntegrationsService]
})
export class GoogleIntegrationModule {}
