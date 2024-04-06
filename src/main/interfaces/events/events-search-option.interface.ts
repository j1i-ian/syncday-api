import { EventStatus } from '@entity/events/event-status.enum';

export interface EventsSearchOption {
    onlySatisfiedHost?: boolean;
    hasUserPhone?: boolean;
    teamId?: number;
    teamUUID?: string;
    teamWorkspace?: string;
    availabilityId?: number;
    status?: EventStatus;
    public?: boolean;
}
