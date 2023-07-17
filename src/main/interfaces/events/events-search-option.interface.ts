import { EventStatus } from '@entity/events/event-status.enum';

export interface EventsSearchOption {
    userId?: number;
    userUUID?: string;
    userWorkspace?: string;
    availabilityId?: number;
    status?: EventStatus;
}
