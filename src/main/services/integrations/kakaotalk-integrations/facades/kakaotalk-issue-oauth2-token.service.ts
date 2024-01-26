import { URL } from 'url';
import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { OAuthToken } from '@interfaces/auth/oauth-token.interface';
import { KakaotalkOAuth2TokenResponse } from '@interfaces/integrations/kakaotalk/kakaotalk-oauth2-token-response.interface';
import { IssueOAuth2Token } from '@interfaces/oauth2/issue-oauth2-token.interface';

@Injectable()
export class KakaotalkIssueOAuth2TokenService implements IssueOAuth2Token {
    async issueOAuthTokenByAuthorizationCode(
        authorizationCode: string,
        clientId: string,
        redirectURI: string
    ): Promise<OAuthToken> {

        const headers = this.getHeaders();

        const tokenUrl = new URL(this.url);
        tokenUrl.searchParams.append('grant_type', 'authorization_code');
        tokenUrl.searchParams.append('code', authorizationCode);
        tokenUrl.searchParams.append('client_id', clientId);
        tokenUrl.searchParams.append('redirect_uri', redirectURI);

        const issuedTokenHttpResponse = await fetch(tokenUrl.toString(), {
            method: 'POST',
            headers
        });

        const tokenResponse: KakaotalkOAuth2TokenResponse = await issuedTokenHttpResponse.json();

        return {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token
        };
    }

    issueOAuthTokenByRefreshToken(): Promise<OAuthToken> {
        throw new Error('Method not implemented.');
    }

    getHeaders(): { [headerKey: string]: string } {
        return {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
    }

    get url(): string {
        return 'https://kauth.kakao.com/oauth/token';
    }
}
