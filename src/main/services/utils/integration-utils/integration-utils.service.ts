import { Injectable } from '@nestjs/common';
import { Auth, calendar_v3, google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '@configs/app-config.service';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ConferenceLink } from '@entities/scheduled-events/conference-link.entity';

@Injectable()
export class IntegrationUtilsService {

    constructor(private readonly configService: ConfigService) {}

    getGoogleOAuthClient(refreshToken: string): Auth.OAuth2Client {

        const credentials = AppConfigService.getGoogleCredentials(this.configService);
        const newOAuthClient = new google.auth.OAuth2({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret
        });
        newOAuthClient.credentials = {
            refresh_token: refreshToken
        };

        return newOAuthClient;
    }

    getGoogleMeetLink(createdGoogleCalendarEvent: calendar_v3.Schema$Event): ConferenceLink {

        const googleMeetConferenceLink = createdGoogleCalendarEvent.conferenceData as calendar_v3.Schema$ConferenceData;
        const generatedGoogleMeetLink = (googleMeetConferenceLink.entryPoints as calendar_v3.Schema$EntryPoint[])[0].uri;
        const convertedConferenceLink: ConferenceLink = {
            type: IntegrationVendor.GOOGLE,
            serviceName: 'Google Meet',
            link: generatedGoogleMeetLink
        };

        return convertedConferenceLink;
    }
}
