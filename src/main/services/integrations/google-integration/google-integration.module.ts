import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleOAuthClientService } from '@services/integrations/google-integration/facades/google-oauth-client.service';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleOAuthUserService } from '@services/integrations/google-integration/facades/google-oauth-user.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { GoogleIntegrationSchedulesService } from '@services/integrations/google-integration/google-integration-schedules/google-integration-schedules.service';
import { GoogleCalendarEventWatchService } from '@services/integrations/google-integration/facades/google-calendar-event-watch.service';
import { GoogleCalendarEventWatchStopService } from '@services/integrations/google-integration/facades/google-calendar-event-watch-stop.service';
import { GoogleCalendarEventCreateService } from '@services/integrations/google-integration/facades/google-calendar-event-create.service';
import { GoogleCalendarEventPatchService } from '@services/integrations/google-integration/facades/google-calendar-event-patch.service';
import { GoogleIntegration } from '@entities/integrations/google/google-integration.entity';
import { GoogleIntegrationScheduledEvent } from '@entities/integrations/google/google-integration-scheduled-event.entity';
import { IntegrationsRedisRepository } from '@repositories/integrations/integration-redis.repository';
import { GoogleOAuthTokenService } from './facades/google-oauth-token.service';
import { GoogleCalendarListService } from './facades/google-calendar-list.service';
import { GoogleCalendarEventListService } from './facades/google-calendar-event-list.service';
import { GoogleCalendarIntegrationsModule } from './google-calendar-integrations/google-calendar-integrations.module';
import { GoogleConferenceLinkIntegrationService } from './google-conference-link-integration/google-conference-link-integration.service';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([GoogleIntegration, GoogleIntegrationScheduledEvent]),
        GoogleCalendarIntegrationsModule
    ],
    providers: [
        GoogleIntegrationFacade,
        GoogleOAuthClientService,
        GoogleOAuthTokenService,
        GoogleOAuthUserService,
        GoogleCalendarListService,

        GoogleCalendarEventListService,
        GoogleIntegrationsService,
        GoogleIntegrationSchedulesService,
        GoogleCalendarEventWatchService,
        GoogleCalendarEventWatchStopService,

        IntegrationsRedisRepository,

        GoogleCalendarEventCreateService,
        GoogleCalendarEventPatchService,
        GoogleConferenceLinkIntegrationService
    ],
    exports: [GoogleIntegrationFacade, GoogleIntegrationsService, GoogleIntegrationSchedulesService]
})
export class GoogleIntegrationModule {}
