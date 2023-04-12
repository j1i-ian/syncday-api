import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateZoomMeetingIntegrationRequest } from '@dto/integrations/zoom/create-zoom-meeting-integration-request.dto';
import { AuthUser } from '@app/decorators/auth-user.decorator';
import { AppJwtPayload } from '@app/auth/strategy/jwt/app-jwt-payload.interface';
import { ZoomMeetingIntegrationService } from './zoom-meeting-integration.service';

@Controller()
export class ZoomMeetingController {
    constructor(private readonly zoomMeetingIntegrationService: ZoomMeetingIntegrationService) {}

    @Post()
    @HttpCode(HttpStatus.NO_CONTENT)
    async createZoomMeeting(
        @AuthUser() authUser: AppJwtPayload,
        @Body() requestBody: CreateZoomMeetingIntegrationRequest
    ): Promise<void> {
        const { zoomAuthCode } = requestBody;
        await this.zoomMeetingIntegrationService.createIntegration(authUser.id, zoomAuthCode);
    }
}
