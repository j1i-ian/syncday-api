import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';

export interface GoogleIntegrationState {
    integrationContext: IntegrationContext;

    // sync user's email
    requestUserEmail?: string | undefined;
}
