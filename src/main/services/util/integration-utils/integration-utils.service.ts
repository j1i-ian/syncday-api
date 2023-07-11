import { Injectable } from '@nestjs/common';
import { Auth, google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '@config/app-config.service';

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

}
