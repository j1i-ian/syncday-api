import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { CreatedUserAndTeam } from '@services/users/created-user-and-team.interface';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Language } from '@app/enums/language.enum';
import { SyncdayOAuth2TokenResponse } from '@app/interfaces/auth/syncday-oauth2-token-response.interface';

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
    ): Promise<OAuth2UserProfile>;

    signUpWithOAuth(
        timezone: string,
        oauth2UserProfile: OAuth2UserProfile,
        language: Language
    ): Promise<CreatedUserAndTeam>;

    multipleSocialSignIn(
        user: User,
        ensuredRequesterEmail: string
    ): Promise<void>;

    integrate(
        oauth2UserProfile: OAuth2UserProfile,
        user: User,
        profile: Profile,
        teamSetting: TeamSetting
    ): Promise<void>;

    getEmailFromOAuth2UserProfile(
        oauth2UserProfile: OAuth2UserProfile
    ): string;
}
