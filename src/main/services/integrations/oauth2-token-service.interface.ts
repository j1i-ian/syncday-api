import { OAuth2AccountUserProfileMetaInfo } from '@interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { SyncdayOAuth2TokenResponse } from '@interfaces/auth/syncday-oauth2-token-response.interface';
import { OAuth2Converter } from '@services/integrations/oauth2-converter.interface';
import { User } from '@entities/users/user.entity';
import { Profile } from '@entities/profiles/profile.entity';
import { TeamSetting } from '@entities/teams/team-setting.entity';

export interface OAuth2TokenService {

    generateOAuth2AuthoizationUrl(
        integrationContext: IntegrationContext,
        timezone: string | null,
        decodedUserOrNull: User | null
    ): string;

    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponse: SyncdayOAuth2TokenResponse
    ): string;

    getOAuth2UserProfile(
        authorizationCode: string
    ): Promise<OAuth2AccountUserProfileMetaInfo>;

    multipleSocialSignIn(
        user: User,
        ensuredRequesterEmail: string
    ): Promise<void>;

    integrate(
        oauth2UserProfile: OAuth2AccountUserProfileMetaInfo,
        user: User,
        profile: Profile,
        teamSetting: TeamSetting
    ): Promise<void>;

    getEmailFromOAuth2UserProfile(
        oauth2UserProfile: OAuth2AccountUserProfileMetaInfo
    ): string;

    get converter(): OAuth2Converter;
}
