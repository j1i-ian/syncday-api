import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { GoogleIntegrationBody } from '@core/interfaces/integrations/google/google-integration-body.interface';
import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';
import { IntegrationSearchOption } from '@interfaces/integrations/integration-search-option.interface';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';
import { Integration } from '@entity/integrations/integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { User } from '@entity/users/user.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { IntegrationResponseDto } from '@dto/integrations/integration-response.dto';
import { SyncdayGoogleOAuthTokenResponse } from '@app/interfaces/auth/syncday-google-oauth-token-response.interface';

type GoogleIntegrationRequest =  [User, UserSetting, OAuthToken, GoogleCalendarIntegration[], GoogleIntegrationBody];
type ZoomIntegrationRequest = [User, OAuthToken, OAuth2UserProfile];
type AppleIntegrationRequest = [User, UserSetting, AppleCalDAVCredential, string];

/**
 * Abstract Factory pattern for integration services.
 */
export interface IntegrationsFactory {

    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponseOrSyncdayAccessToken?: string | SyncdayGoogleOAuthTokenResponse
    ): string;

    search(userSearchOption: IntegrationSearchOption): Promise<Array<Integration | IntegrationResponseDto>>;

    findOne(userSearchOption: IntegrationSearchOption): Promise<(Integration | IntegrationResponseDto) | null>;

    create(...argument: (ZoomIntegrationRequest | GoogleIntegrationRequest | AppleIntegrationRequest)): Promise<Integration>;

    remove(vendorIntegrationId: number, userId: number): Promise<boolean>;
}
