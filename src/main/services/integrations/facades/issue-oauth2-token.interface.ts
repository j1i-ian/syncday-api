/* eslint-disable @typescript-eslint/no-explicit-any */
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';

export interface IssueOAuth2Token {
    issueOAuthTokenByAuthorizationCode(...args: any): Promise<OAuthToken>;
    issueOAuthTokenByRefreshToken(...args: any): Promise<OAuthToken>;
}
