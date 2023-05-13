import { BadRequestException, Injectable, Scope } from '@nestjs/common';
import { Auth } from 'googleapis';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';

@Injectable({
    scope: Scope.REQUEST
})
export class GoogleOAuthTokenService {
    async issueGoogleTokenByAuthorizationCode(
        oauthClient: Auth.OAuth2Client,
        authorizationCode: string
    ): Promise<OAuthToken> {
        const { tokens } = await oauthClient.getToken(authorizationCode);
        const { access_token: accessToken, refresh_token: refreshToken } = tokens;

        if (!accessToken || !refreshToken) {
            throw new BadRequestException(
                'Failed to fetch access token, refresh token with Google'
            );
        }

        return { accessToken, refreshToken };
    }
}
