import { EntityManager } from 'typeorm';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';
import { GoogleIntegrationBody } from '@app/interfaces/integrations/google/google-integration-body.interface';
import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';

export interface IntegrationsServiceInterface {
    search(userSearchOptino: SearchByUserOption): Promise<Integration[]>;

    create(
        user: User,
        authToken: OAuthToken,
        calendarIntegrations: GoogleCalendarIntegration[],
        integrationBody: GoogleIntegrationBody
    ): Promise<Integration>;

    _create(
        manager: EntityManager,
        user: User,
        authToken: OAuthToken,
        calendarIntegrations: GoogleCalendarIntegration[],
        integrationBody: GoogleIntegrationBody
    ): Promise<Integration>;
}
