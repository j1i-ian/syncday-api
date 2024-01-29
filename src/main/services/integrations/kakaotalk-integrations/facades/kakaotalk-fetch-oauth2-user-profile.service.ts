import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { KakaotalkUserProfileResponse } from '@app/interfaces/integrations/kakaotalk/kakaotalk-user-profile-response.interface';

@Injectable()
export class KakaotalkFetchOAuth2UserProfileService {

    async getOAuth2UserProfile(
        oauth2Token: OAuthToken
    ): Promise<KakaotalkUserProfileResponse> {

        const {
            accessToken
        } = oauth2Token;

        const headers = this.getHeaders(accessToken);

        const userProfileResponse = await fetch(this.url, {
            headers
        });

        const kakaotalkUserProfile: KakaotalkUserProfileResponse = await userProfileResponse.json();

        kakaotalkUserProfile.oauth2Token = oauth2Token;
        kakaotalkUserProfile.integrationUserUniqueId = String(kakaotalkUserProfile.id);

        return kakaotalkUserProfile;
    }

    private getHeaders(accessToken: string): { [header: string]: string } {
        return {
            Authorization: `Bearer ${accessToken}`
        };
    }

    private get url(): string {
        return 'https://kapi.kakao.com/v2/user/me';
    }
}
