import { EntityManager } from 'typeorm';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { GoogleIntegrationBody } from '@core/interfaces/integrations/google/google-integration-body.interface';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';

export interface IntegrationsServiceInterface {
    search(userSearchOptino: SearchByUserOption): Promise<Integration[]>;

    create(
        user: User,
        userSetting: UserSetting,
        authToken: OAuthToken,
        calendarIntegrations: GoogleCalendarIntegration[],
        integrationBody: GoogleIntegrationBody
    ): Promise<Integration>;

    _create(
        manager: EntityManager,
        user: User,
        userSetting: UserSetting,
        authToken: OAuthToken,
        calendarIntegrations: GoogleCalendarIntegration[],
        integrationBody: GoogleIntegrationBody
    ): Promise<Integration>;
}
