import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleOAuthClientService } from '@services/integrations/google-integration/facades/google-oauth-client.service';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleOAuthUserService } from '@services/integrations/google-integration/facades/google-oauth-user.service';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleOAuthTokenService } from './facades/google-oauth-token.service';
import { GoogleCalendarListService } from './facades/google-calendar-list.service';
import { GoogleConverterService } from './google-converter/google-converter.service';

@Module({
    imports: [ConfigModule, TypeOrmModule.forFeature([GoogleIntegration])],
    providers: [
        GoogleIntegrationFacade,
        GoogleOAuthClientService,
        GoogleOAuthTokenService,
        GoogleOAuthUserService,
        GoogleCalendarListService,
        GoogleConverterService
    ],
    exports: [GoogleIntegrationFacade, GoogleConverterService]
})
export class GoogleIntegrationModule {}
