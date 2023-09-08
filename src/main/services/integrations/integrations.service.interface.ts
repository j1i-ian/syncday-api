import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { GoogleIntegrationBody } from '@core/interfaces/integrations/google/google-integration-body.interface';
import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';
import { Integration } from '@entity/integrations/integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { User } from '@entity/users/user.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { FetchZoomMeetingIntegrationResponse } from '@dto/integrations/zoom/fetch-zoom-meeting-integration-response.dto';
import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';
import { SyncdayGoogleOAuthTokenResponse } from '@app/interfaces/auth/syncday-google-oauth-token-response.interface';

type GoogleIntegrationRequest =  [User, UserSetting, OAuthToken, GoogleCalendarIntegration[], GoogleIntegrationBody];
type ZoomIntegrationRequest = [User, OAuthToken, OAuth2UserProfile];

export interface IntegrationsServiceInterface {

    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponseOrSyncdayAccessToken?: string | SyncdayGoogleOAuthTokenResponse
    ): string;

    search(userSearchOption: SearchByUserOption): Promise<Array<Integration | FetchZoomMeetingIntegrationResponse>>;

    findOne(userSearchOption: SearchByUserOption): Promise<(Integration | FetchZoomMeetingIntegrationResponse) | null>;

    create(...argument: (ZoomIntegrationRequest | GoogleIntegrationRequest)): Promise<Integration>;

    remove(vendorIntegrationId: number, userId: number): Promise<boolean>;
}
