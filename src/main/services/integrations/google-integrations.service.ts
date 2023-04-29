import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { google, Auth } from 'googleapis';
import { Repository } from 'typeorm';
import { GoogleIntegration } from '../../../@core/core/entities/integrations/google/google-integration.entity';
import { User } from '../../../@core/core/entities/users/user.entity';
import { IntegrationUtilService } from '../util/integration-util/integraion-util.service';

@Injectable()
export class GoogleIntegrationsService {
    constructor(
        private readonly configService: ConfigService,
        private readonly integrationUtilService: IntegrationUtilService,
        @InjectRepository(GoogleIntegration)
        private readonly googleIntegrationRepository: Repository<GoogleIntegration>
    ) {
        this.oauth2ClientMap = new Map<string, Auth.OAuth2Client>();
    }

    private oauth2ClientMap: Map<string, Auth.OAuth2Client>;

    async loadAlreadySignedUpUser(email: string): Promise<User | null> {
        const loadedGoogleIntegration = await this.findGoogleIntegrationByUserEmail(email);

        return loadedGoogleIntegration ? loadedGoogleIntegration.users[0] : null;
    }

    async findGoogleIntegrationByUserEmail(userEmail: string): Promise<GoogleIntegration | null> {
        const loadedGoogleIntegration = await this.googleIntegrationRepository
            .createQueryBuilder('googleIntegration')
            .leftJoinAndSelect('googleIntegration.users', 'user')
            .where('user.email = :userEmail', {
                userEmail
            })
            .getOne();

        return loadedGoogleIntegration;
    }

    async getGoogleIntegrations(userId: number): Promise<GoogleIntegration[]> {
        return await this.googleIntegrationRepository.find({
            relations: {
                users: true
            },
            where: {
                users: {
                    id: userId
                }
            }
        });
    }

    _createOAuthClient(redirectUri: string): Auth.OAuth2Client {
        const oauthClient = this.oauth2ClientMap.get(redirectUri);

        let ensuredOAuthClient: Auth.OAuth2Client;

        if (!oauthClient) {
            const newOAuthClient = new google.auth.OAuth2({
                clientId: this.configService.get<string>('GOOGLE_CLIENT_ID') || '',
                clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
                redirectUri
            });
            this.oauth2ClientMap.set(redirectUri, newOAuthClient);
            ensuredOAuthClient = newOAuthClient;
        } else {
            ensuredOAuthClient = oauthClient;
        }

        return ensuredOAuthClient;
    }
}
