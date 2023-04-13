import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CreateZoomMeetingIntegrationRequest } from '@dto/integrations/zoom/create-zoom-meeting-integration-request.dto';
import { AuthUser } from '@app/decorators/auth-user.decorator';
import { AppJwtPayload } from '@app/auth/strategy/jwt/app-jwt-payload.interface';
import { CreateZoomMeetingIntegrationResponse } from '../../../../dto/integrations/zoom/create-zoom-meeting-integration-response.dto';
import { ZoomMeetingIntegrationService } from './zoom-meeting-integration.service';

@Controller()
export class ZoomMeetingController {
    constructor(private readonly zoomMeetingIntegrationService: ZoomMeetingIntegrationService) {}

    @Post()
    async createZoomMeeting(
        @AuthUser() authUser: AppJwtPayload,
        @Body() requestBody: CreateZoomMeetingIntegrationRequest
    ): Promise<CreateZoomMeetingIntegrationResponse> {
        const { zoomAuthCode } = requestBody;
        const zoomIntergration = await this.zoomMeetingIntegrationService.createIntegration(
            authUser.id,
            zoomAuthCode
        );

        return plainToInstance(CreateZoomMeetingIntegrationResponse, zoomIntergration, {
            excludeExtraneousValues: true
        });
    }

    @Delete(':zoomIntegrationId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async disconnectZoomMeeting(
        @Param('zoomIntegrationId') zoomIntegrationId: number
    ): Promise<void> {
        await this.zoomMeetingIntegrationService.disconnectIntegration(zoomIntegrationId);
    }
}
