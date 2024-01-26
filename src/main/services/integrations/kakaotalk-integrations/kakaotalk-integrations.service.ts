/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { OAuthToken } from '@interfaces/auth/oauth-token.interface';
import { OAuth2AccountUserProfileMetaInfo } from '@interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { IntegrationSearchOption } from '@interfaces/integrations/integration-search-option.interface';
import { SyncdayOAuth2TokenResponse } from '@interfaces/auth/syncday-oauth2-token-response.interface';
import { IntegrationsFactory } from '@services/integrations/integrations.factory.interface';
import { Integration } from '@entities/integrations/integration.entity';
import { Profile } from '@entities/profiles/profile.entity';

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

    create(profile: Profile, oauthToken: OAuthToken, oauth2UserProfile: OAuth2AccountUserProfileMetaInfo): Promise<Integration> {
        throw new Error('Method not implemented.');
    }

    patch(vendorIntegrationId: number, profileId: number, paritalIntegration?: Partial<Integration> | undefined): Observable<boolean> {
        throw new Error('Method not implemented.');
    }

    remove(vendorIntegrationId: number, profileId: number): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
}
