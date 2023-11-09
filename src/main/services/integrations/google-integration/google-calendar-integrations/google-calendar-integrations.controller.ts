import { BadRequestException, Controller, Headers, Inject, Param, Post } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { Public } from '@app/auth/strategy/jwt/public.decorator';

@Controller()
export class GoogleCalendarIntegrationsController {

    constructor(
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    /**
     * The API For Google Calendar Conflict Check (Inboud)
     *
     * @param xGoogChannelId
     * @param xGoogResourceId
     * @param xGoogChannelExpiration
     * @param syncdayGoogleCalendarIntegrationUUID
     * @returns
     */
    @Post(':syncdayGoogleCalendarIntegrationUUID')
    @Public()
    async googleCalendarEventsNotification(
        @Headers('x-goog-channel-id') xGoogChannelId: string,
        @Headers('x-goog-resource-id') xGoogResourceId: string,
        @Headers('x-goog-channel-expiration') xGoogChannelExpiration: string,

        @Param('syncdayGoogleCalendarIntegrationUUID') syncdayGoogleCalendarIntegrationUUID: string
    ): Promise<boolean> {

        this.logger.info({
            message: 'Google Calendar is notified',
            xGoogChannelId,
            xGoogResourceId,
            xGoogChannelExpiration,
            syncdayGoogleCalendarIntegrationUUID
        });

        if (!syncdayGoogleCalendarIntegrationUUID) {
            throw new BadRequestException('invalid syncdayGoogleCalendarIntegrationUUID');
        }

        // unsubscribe orphan channel
        const subscriptionStatus = await this.googleCalendarIntegrationsService.getGoogleCalendarSubscriptionStatus(xGoogChannelId);

        this.logger.info({
            message: 'Subscription status',
            xGoogChannelId,
            subscriptionStatus
        });

        if (subscriptionStatus) {
            await this.googleCalendarIntegrationsService.synchronizeWithGoogleCalendarEvents(
                syncdayGoogleCalendarIntegrationUUID
            );
        } else {
            // TODO: unsubscribe orphan calendar
            this.logger.warn({
                message: 'Orphan Calendar is detected. You should implement the code for unsubscription'
            });
        }


        return true;
    }
}
