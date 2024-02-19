import { OAuth2AccountUserProfileMetaInfo } from '@core/interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { OAuth2Converter } from '@services/integrations/oauth2-converter.interface';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { SyncdayOAuth2TokenResponse } from '@app/interfaces/auth/syncday-oauth2-token-response.interface';

export interface OAuth2TokenService {

    generateOAuth2AuthoizationUrl(
        integrationContext: IntegrationContext,
        timezone: string | null,
        decodedUserOrNull: AppJwtPayload | null
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
