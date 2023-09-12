import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';

export interface SearchZoomIntegrationOptions extends SearchByUserOption {
    integrationUserUniqueId: string;
}
