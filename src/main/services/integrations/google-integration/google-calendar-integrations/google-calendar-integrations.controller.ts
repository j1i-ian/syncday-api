import { BadRequestException, Controller, Headers, Inject, Logger, Param, Post } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { GoogleCalendarEventWatchStopService } from '@services/integrations/google-integration/facades/google-calendar-event-watch-stop.service';
import { IntegrationUtilsService } from '@services/util/integration-utils/integration-utils.service';
import { Public } from '@app/auth/strategy/jwt/public.decorator';

@Controller()
export class GoogleCalendarIntegrationsController {

    constructor(
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService,
        private readonly integrationUtilsService: IntegrationUtilsService,
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

        this.logger.debug({
            message: 'Google Calendar is notified',
            xGoogChannelId,
            xGoogResourceId,
            xGoogChannelExpiration
        });

        if (!syncdayGoogleCalendarIntegrationUUID) {
            throw new BadRequestException('invalid syncdayGoogleCalendarIntegrationUUID');
        }

        // unsubscribe orphan channel
        const subscriptionStatus = await this.googleCalendarIntegrationsService.getGoogleCalendarSubscriptionStatus(xGoogChannelId);

        if (subscriptionStatus) {
            await this.googleCalendarIntegrationsService.synchronizeWithGoogleCalendarEvents(
                syncdayGoogleCalendarIntegrationUUID
            );
        } else {
            // TODO: unsubscribe orphan calendar
            this.logger.warn('Orphan Calendar is detected. You should implement the code for unsubscription');

            await this.tmp(xGoogChannelId, xGoogResourceId);
        }


        return true;
    }

    async tmp(xGoogChannelId: string,
        xGoogResourceId: string): Promise<void> {

        const refreshToken = '1//0eJ9NfRsykyVpCgYIARAAGA4SNwF-L9IrvGv_mBVigN22yH7v8PExeK6APWYhcVH1I1WZk5VYeRLaBQbLy4G7deFEtOs-MfhxwIk';
        const newOAuthClient = this.integrationUtilsService.getGoogleOAuthClient(refreshToken);

        const googleCalendarEventWatchStopService = new GoogleCalendarEventWatchStopService();

        console.log('unsubscribe orphan...');
        await googleCalendarEventWatchStopService.stopWatch(
            newOAuthClient,
            xGoogChannelId,
            xGoogResourceId
        );

    }
}
