import { calendar_v3, oauth2_v2 } from 'googleapis';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';

export interface GoogleOAuth2UserWithToken {
    googleUser: oauth2_v2.Schema$Userinfo & {
        email: string;
        name: string;
        picture: string;
    };
    calendars: calendar_v3.Schema$CalendarList;
    tokens: OAuthToken;
}
