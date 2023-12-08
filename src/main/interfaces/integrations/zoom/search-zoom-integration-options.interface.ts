import { SearchByProfileOption } from '@interfaces/profiles/search-by-profile-option.interface';

export interface SearchZoomIntegrationOptions extends SearchByProfileOption {
    integrationUserUniqueId?: string;
}
