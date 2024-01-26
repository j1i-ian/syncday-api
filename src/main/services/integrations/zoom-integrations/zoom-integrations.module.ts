import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ZoomIntegrationsService } from '@services/integrations/zoom-integrations/zoom-integrations.service';
import { ZoomOauthTokenService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-token.service';
import { ZoomOauthUserService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-user.service';
import { ZoomIntegrationFacade } from '@services/integrations/zoom-integrations/zoom-integrations.facade';
import { ZoomCreateMeetingService } from '@services/integrations/zoom-integrations/facades/zoom-create-meeting.service';
import { ZoomIntegration } from '@entities/integrations/zoom/zoom-integration.entity';
import { ZoomIntegrationsController } from './zoom-integrations.controller';
import { ZoomConferenceLinkIntegrationsService } from './zoom-conference-link-integrations/zoom-conference-link-integrations.service';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([ZoomIntegration])
    ],
    providers: [
        JwtService,
        ZoomIntegrationsService,
        ZoomIntegrationFacade,
        ZoomOauthTokenService,
        ZoomOauthUserService,
        ZoomCreateMeetingService,
        ZoomConferenceLinkIntegrationsService
    ],
    exports: [ZoomIntegrationsService, ZoomIntegrationFacade],
    controllers: [ZoomIntegrationsController]
})
export class ZoomIntegrationsModule {}
