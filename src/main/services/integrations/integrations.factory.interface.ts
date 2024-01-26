import { Observable } from 'rxjs';
import { OAuthToken } from '@interfaces/auth/oauth-token.interface';
import { GoogleIntegrationBody } from '@interfaces/integrations/google/google-integration-body.interface';
import { OAuth2AccountUserProfileMetaInfo } from '@interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { IntegrationSearchOption } from '@interfaces/integrations/integration-search-option.interface';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';
import { SyncdayOAuth2TokenResponse } from '@interfaces/auth/syncday-oauth2-token-response.interface';
import { CalendarCreateOption } from '@interfaces/integrations/calendar-create-option.interface';
import { Integration } from '@entities/integrations/integration.entity';
import { UserSetting } from '@entities/users/user-setting.entity';
import { GoogleCalendarIntegration } from '@entities/integrations/google/google-calendar-integration.entity';
import { Profile } from '@entities/profiles/profile.entity';
import { TeamSetting } from '@entities/teams/team-setting.entity';
import { User } from '@entities/users/user.entity';

type GoogleIntegrationRequest =  [Profile, TeamSetting, User, UserSetting, OAuthToken, GoogleCalendarIntegration[], GoogleIntegrationBody, CalendarCreateOption?];
type ZoomIntegrationRequest = [Profile, OAuthToken, OAuth2AccountUserProfileMetaInfo];
type AppleIntegrationRequest = [Profile, UserSetting, TeamSetting, AppleCalDAVCredential, string];

/**
 * Abstract Factory pattern for integration services.
 */
export interface IntegrationsFactory {

    /**
     * This method redirects users to external services such as Zoom or Google Meet for
     * integration purposes
     *
     * @param syncdayGoogleOAuthTokenResponseOrSyncdayAccessToken
     */
    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponseOrSyncdayAccessToken?: string | SyncdayOAuth2TokenResponse
    ): string;

    search(integrationSearchOption: IntegrationSearchOption): Promise<Integration[]>;

    validate(loadedIntegration: Integration): Observable<boolean>;

    count(integrationSearchOption: IntegrationSearchOption): Promise<number>;

    findOne(integrationSearchOption: IntegrationSearchOption): Promise<(Integration) | null>;

    create(...argument: (ZoomIntegrationRequest | GoogleIntegrationRequest | AppleIntegrationRequest)): Promise<Integration>;

    patch(vendorIntegrationId: number, profileId: number, paritalIntegration?: Partial<Integration>): Observable<boolean>;

    remove(vendorIntegrationId: number, profileId: number, teamId?: number): Promise<boolean>;
}
