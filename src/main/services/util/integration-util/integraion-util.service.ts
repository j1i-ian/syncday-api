import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth, oauth2_v2 } from 'googleapis';
import { AppConfigService } from '@config/app-config.service';
@Injectable()
export class IntegrationUtilService {
    constructor(private readonly configService: ConfigService) {}

    getGoogleOauthClient(redirectUri?: string): Auth.OAuth2Client {
        const oauth2Client = new google.auth.OAuth2({
            ...AppConfigService.getGoogleCredentials(this.configService),
            redirectUri
        });

        return oauth2Client;
    }

    async getGoogleUserInfo(
        refreshToken: string,
        oauthClient: Auth.OAuth2Client
    ): Promise<oauth2_v2.Schema$Userinfo> {
        oauthClient.setCredentials({
            refresh_token: refreshToken
        });

        const oauth2 = google.oauth2({
            version: 'v2',
            auth: oauthClient
        });

        const { data } = await oauth2.userinfo.get();
        return data;
    }
}
