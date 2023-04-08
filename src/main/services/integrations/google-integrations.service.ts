import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { google, Auth } from 'googleapis';
import { EntityManager, Repository } from 'typeorm';
import { GoogleIntegration } from '../../../@core/core/entities/integrations/google/google-integration.entity';
import { User } from '../../../@core/core/entities/users/user.entity';
import { EnsuredGoogleOAuth2User } from '../../auth/token/token.service';
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

    async saveGoogleIntegrationForGoogleUser(
        transactionManager: EntityManager,
        googleUser: EnsuredGoogleOAuth2User
    ): Promise<GoogleIntegration> {
        const googleIntegration: GoogleIntegration = new GoogleIntegration();
        googleIntegration.refreshToken = googleUser.refreshToken;
        googleIntegration.accessToken = googleUser.accessToken;
        googleIntegration.email = googleUser.email;

        const _googleIntegrationRepository = transactionManager.getRepository(GoogleIntegration);
        const savedGoogleIntegration = await _googleIntegrationRepository.save(googleIntegration);
        return savedGoogleIntegration;
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
