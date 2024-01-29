import { OAuth2AccountUserProfileMetaInfo } from '@core/interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { KakaotalkUserProfile } from '@app/interfaces/integrations/kakaotalk/kakaotalk-user-profile.interface';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @see {@link [Kakaotalk Develoeprs API Document](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info)}
 */

export interface KakaotalkUserProfileResponse extends OAuth2AccountUserProfileMetaInfo {
    id: number;
    has_signed_up: boolean;
    connected_at: Date;
    synched_at: Date;
    properties: string;
    kakao_account: KakaotalkUserProfile;
    for_partner: any;

    oauth2Token: OAuthToken;
}
