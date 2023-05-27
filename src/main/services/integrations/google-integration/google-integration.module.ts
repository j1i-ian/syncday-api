import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleOAuthClientService } from '@services/integrations/google-integration/facades/google-oauth-client.service';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleOAuthUserService } from '@services/integrations/google-integration/facades/google-oauth-user.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { GoogleOAuthTokenService } from './facades/google-oauth-token.service';
import { GoogleCalendarListService } from './facades/google-calendar-list.service';
import { GoogleConverterService } from './google-converter/google-converter.service';
import { GoogleCalendarIntegrationsService } from './google-calendar-integrations/google-calendar-integrations.service';

@Module({
    imports: [ConfigModule, TypeOrmModule.forFeature([GoogleCalendarIntegration])],
    providers: [
        GoogleIntegrationFacade,
        GoogleOAuthClientService,
        GoogleOAuthTokenService,
        GoogleOAuthUserService,
        GoogleCalendarListService,
        GoogleConverterService,

        GoogleCalendarIntegrationsService
    ],
    exports: [GoogleIntegrationFacade, GoogleConverterService, GoogleCalendarIntegrationsService]
})
export class GoogleIntegrationModule {}
