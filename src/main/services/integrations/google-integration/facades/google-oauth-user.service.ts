import { Injectable, Scope } from '@nestjs/common';
import { Auth, google, oauth2_v2 } from 'googleapis';

@Injectable({
    scope: Scope.REQUEST
})
export class GoogleOAuthUserService {
    async getGoogleUserInfo(oauthClient: Auth.OAuth2Client): Promise<oauth2_v2.Schema$Userinfo> {
        const oauth2 = google.oauth2({
            version: 'v2',
            auth: oauthClient
        });

        const { data } = await oauth2.userinfo.get({
            auth: oauthClient
        });

        return data;
    }
}
