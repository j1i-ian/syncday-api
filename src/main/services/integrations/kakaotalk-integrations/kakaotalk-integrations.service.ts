/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';
import { IntegrationSearchOption } from '@interfaces/integrations/integration-search-option.interface';
import { IntegrationsFactory } from '@services/integrations/integrations.factory.interface';
import { Integration } from '@entity/integrations/integration.entity';
import { User } from '@entity/users/user.entity';
import { SyncdayOAuth2TokenResponse } from '@app/interfaces/auth/syncday-oauth2-token-response.interface';

@Injectable()
export class KakaotalkIntegrationsService implements IntegrationsFactory {

    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponseOrSyncdayAccessToken?: string | SyncdayOAuth2TokenResponse | undefined
    ): string {
        throw new Error('Method not implemented.');
    }

    search(userSearchOption: IntegrationSearchOption): Promise<Integration[]> {
        throw new Error('Method not implemented.');
    }

    validate(loadedIntegration: Integration): Observable<boolean> {
        throw new Error('Method not implemented.');
    }

    count(userSearchOption: IntegrationSearchOption): Promise<number> {
        throw new Error('Method not implemented.');
    }

    findOne(userSearchOption: IntegrationSearchOption): Promise<Integration | null> {
        throw new Error('Method not implemented.');
    }

    create(user: User, oauthToken: OAuthToken, oauth2UserProfile: OAuth2UserProfile): Promise<Integration> {
        throw new Error('Method not implemented.');
    }

    patch(vendorIntegrationId: number, userId: number, paritalIntegration?: Partial<Integration> | undefined): Observable<boolean> {
        throw new Error('Method not implemented.');
    }

    remove(vendorIntegrationId: number, userId: number): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
}
