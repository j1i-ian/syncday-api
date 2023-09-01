import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';

export interface IntegrationsFacade {
    issueToken(authorizationCode: string): Promise<OAuthToken>;
    issueTokenByRefreshToken(refreshToken: string): Promise<OAuthToken>;

    fetchOAuth2User(oauth2Token: OAuthToken): Promise<OAuth2UserProfile>;

    getOAuth2SuccessRedirectURI(): string;
}
