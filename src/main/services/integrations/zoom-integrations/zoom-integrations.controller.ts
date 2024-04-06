import * as crypto from 'crypto';
import { Body, Controller, Header, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZoomIntegrationsService } from '@services/integrations/zoom-integrations/zoom-integrations.service';
import { ZoomIntegration } from '@entity/integrations/zoom/zoom-integration.entity';
import { ZoomWebhookNotificationRequestDto } from '@app/interfaces/integrations/zoom/zoom-webhook-notification-request.dto';
import { Public } from '@app/auth/strategy/jwt/public.decorator';
import { ValidateZoomEventSubscriptionUrlResponseDto } from '@app/interfaces/integrations/zoom/validate-zoom-event-subscription-url-response.dto';

@Controller()
export class ZoomIntegrationsController {

    constructor(
        private readonly zoomIntegrationService: ZoomIntegrationsService
    ) {}

    @Post('notifications')
    @HttpCode(HttpStatus.OK)
    @Header('Content-type', 'application/json')
    @Public()
    async zoomWebhookNotification(
        @Body() zoomWebhookNotificationRequestDto: ZoomWebhookNotificationRequestDto
    ): Promise<boolean | ValidateZoomEventSubscriptionUrlResponseDto> {

        let webhookResponse: boolean | ValidateZoomEventSubscriptionUrlResponseDto = true;

        // Request to Disconnect Integration due to User Activity on Zoom Page
        if (zoomWebhookNotificationRequestDto.event === 'app_deauthorized') {

            const zoomAccountId = zoomWebhookNotificationRequestDto.payload.account_id;

            const removeTargetZoomIntegration = await this.zoomIntegrationService.findOne({
                integrationUserUniqueId: zoomAccountId
            }) as ZoomIntegration;

            const profile = removeTargetZoomIntegration.profiles[0];

            await this.zoomIntegrationService.remove(removeTargetZoomIntegration.id, profile.id);

            webhookResponse = true;
        } else if (zoomWebhookNotificationRequestDto.event === 'endpoint.url_validation') {
            const zoomUrlValidationRequest = zoomWebhookNotificationRequestDto as unknown as {
                payload: { plainToken: string };
                event_ts: number;
                event: string;
            };

            // creating hmac object
            const genhmac = crypto.createHmac('sha256', 'jQrsVGYXROaKljDkcEdRxg')
                .update(zoomUrlValidationRequest.payload.plainToken)
                .digest('hex');

            const validateZoomEventSubscriptionUrlResponseDto: ValidateZoomEventSubscriptionUrlResponseDto = {
                plainToken: zoomUrlValidationRequest.payload.plainToken,
                encryptedToken: genhmac
            };

            webhookResponse = validateZoomEventSubscriptionUrlResponseDto;
        } else {
            webhookResponse = false;
        }

        return webhookResponse;
    }

}
