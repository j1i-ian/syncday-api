import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ZoomIntegrationsService } from '@services/integrations/zoom-integrations/zoom-integrations.service';
import { ZoomOauthTokenService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-token.service';
import { ZoomOauthUserService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-user.service';
import { ZoomIntegrationFacade } from '@services/integrations/zoom-integrations/zoom-integrations.facade';
import { ZoomCreateMeetingService } from '@services/integrations/zoom-integrations/facades/zoom-create-meeting.service';
import { ZoomIntegration } from '@entity/integrations/zoom/zoom-integration.entity';
import { ZoomIntegrationsController } from './zoom-integrations.controller';

@Module({
    imports: [
        ConfigModule,
        HttpModule,
        TypeOrmModule.forFeature([ZoomIntegration])
    ],
    providers: [
        JwtService,
        ZoomIntegrationsService,
        ZoomIntegrationFacade,
        ZoomOauthTokenService,
        ZoomOauthUserService,
        ZoomCreateMeetingService
    ],
    exports: [ZoomIntegrationsService, ZoomIntegrationFacade],
    controllers: [ZoomIntegrationsController]
})
export class ZoomIntegrationsModule {}
