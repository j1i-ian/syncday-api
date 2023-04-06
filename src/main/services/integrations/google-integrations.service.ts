import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { google, oauth2_v2, Auth } from 'googleapis';
import { Repository } from 'typeorm';
import { GoogleIntegration } from '../../../@core/core/entities/integrations/google/google-integration.entity';

@Injectable()
export class GoogleIntegrationsService {
    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(GoogleIntegration)
        private readonly googleIntegrationRepository: Repository<GoogleIntegration>
    ) {}
    private readonly ISSUE_GOOGLE_TOKEN_API = 'https://oauth2.googleapis.com/token';
    private readonly GET_GOOGLE_USER_API = 'https://oauth2.googleapis.com/token';
    private oauth2Client: Auth.OAuth2Client;

    async issueGoogleTokenByAuthorizationCode(authorizationCode: string): Promise<{
        accessToken: string | null | undefined;
        refreshToken: string | null | undefined;
    }> {
        try {
            const { tokens } = await this.oauth2Client.getToken(authorizationCode);
            return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
        } catch (error) {
            throw new BadRequestException('Failed to link with Google');
        }
    }

    async getGoogleUserInfo(refreshToken: string): Promise<oauth2_v2.Schema$Userinfo> {
        try {
            this.oauth2Client.setCredentials({
                refresh_token: refreshToken
            });
            const oauth2 = google.oauth2('v2');

            const { data } = await oauth2.userinfo.get();
            return data;
        } catch (error) {
            throw new BadRequestException('Failed to retrieve user information from Google');
        }
    }

    setOauthClient(redirectUri: string): void {
        this.oauth2Client = new google.auth.OAuth2({
            clientId: this.configService.get<string>('GOOGLE_CLIENT_ID') || '',
            clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
            redirectUri
        });
        google.options({
            auth: this.oauth2Client
        });
    }

    async saveGoogleIntegration(googleIntegration: GoogleIntegration): Promise<GoogleIntegration> {
        const savedGoogleIntegration = await this.googleIntegrationRepository.save(
            googleIntegration
        );
        return savedGoogleIntegration;
    }
}
