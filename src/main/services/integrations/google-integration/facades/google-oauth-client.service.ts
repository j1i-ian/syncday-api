import { Injectable, Scope } from '@nestjs/common';
import { google, Auth } from 'googleapis';
import { GoogleCredentials } from '@core/interfaces/integrations/google/google-credential.interface';

@Injectable({
    scope: Scope.REQUEST
})
export class GoogleOAuthClientService {
    generateGoogleOAuthClient(
        credentials: GoogleCredentials,
        redirectURI?: undefined | string
    ): Auth.OAuth2Client {
        const newOAuthClient = new google.auth.OAuth2({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            redirectUri: redirectURI
        });

        return newOAuthClient;
    }
}
