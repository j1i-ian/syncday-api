import { OAuthToken } from '@interfaces/auth/oauth-token.interface';
import { OAuth2AccountUserProfileMetaInfo } from '@interfaces/integrations/oauth2-account-user-profile-meta-info.interface';

export interface IntegrationsFacade {
    issueToken(authorizationCode: string): Promise<OAuthToken>;
    issueTokenByRefreshToken(refreshToken: string): Promise<OAuthToken>;

    fetchOAuth2User(oauth2Token: OAuthToken): Promise<OAuth2AccountUserProfileMetaInfo>;

    getOAuth2SuccessRedirectURI(): string;
}
