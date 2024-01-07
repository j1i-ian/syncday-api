import { IntegrationSearchOption } from '@interfaces/integrations/integration-search-option.interface';

export interface SearchZoomIntegrationOptions extends Partial<IntegrationSearchOption> {
    integrationUserUniqueId?: string;
}
