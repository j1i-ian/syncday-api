import { GoogleCalendarAccessRole } from '@interfaces/integrations/google/google-calendar-access-role.enum';

export interface GoogleCalendarIntegrationSearchOption {
    userId: number;
    userUUID: string;
    googleCalendarIntegrationUUID: string;
    conflictCheck: boolean;
    outboundWriteSync: boolean;
    googleCalendarAccessRole: GoogleCalendarAccessRole;
}
