import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { User } from '@entity/users/user.entity';
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
    ): Promise<User>;

    multipleSocialSignIn(
        user: User,
        ensuredRequesterEmail: string
    ): Promise<void>;

    integrate(
        oauth2UserProfile: OAuth2UserProfile,
        user: User
    ): Promise<void>;

    getEmailFromOAuth2UserProfile(
        oauth2UserProfile: OAuth2UserProfile
    ): string;
}
