import { URL } from 'url';
import fetch from 'node-fetch';

import { Injectable } from '@nestjs/common';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { IssueOAuth2Token } from '@services/integrations/facades/issue-oauth2-token.interface';
import { ZoomTokenResponseDTO } from '@app/interfaces/integrations/zoom/zoom-token-response.interface';

@Injectable()
export class ZoomOauthTokenService implements IssueOAuth2Token {

    async issueOAuthTokenByAuthorizationCode(
        authorizationCode: string,
        basicAuth: string,
        redirectURI: string
    ): Promise<OAuthToken> {
        const headers = this._getBasicAuthHeader(basicAuth);

        const tokenUrl = new URL(this.url);
        tokenUrl.searchParams.append('grant_type', 'authorization_code');
        tokenUrl.searchParams.append('code', authorizationCode);
        tokenUrl.searchParams.append('redirect_uri', redirectURI);

        const issuedTokenHttpResponse = await fetch(tokenUrl.toString(), {
            method: 'POST',
            headers
        });

        const tokenResponse: ZoomTokenResponseDTO = await issuedTokenHttpResponse.json();

        return {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token
        };
    }

    async issueOAuthTokenByRefreshToken(
        basicAuth: string,
        refreshToken: string
    ): Promise<OAuthToken> {
        const headers = this._getBasicAuthHeader(basicAuth);

        const tokenUrl = new URL(this.url);
        tokenUrl.searchParams.append('grant_type', 'refresh_token');
        tokenUrl.searchParams.append('refresh_token', refreshToken);

        const issuedTokenHttpResponse = await fetch(tokenUrl.toString(), {
            method: 'POST',
            headers
        });

        const tokenResponse: ZoomTokenResponseDTO = await issuedTokenHttpResponse.json();

        return {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token
        };
    }

    _getBasicAuthHeader(basicAuth: string): { [header: string]: string } {
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${basicAuth}`
        };
    }

    get url(): string {
        return 'https://zoom.us/oauth/token';
    }
}
