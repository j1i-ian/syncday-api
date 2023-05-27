import { Injectable } from '@nestjs/common';
import { calendar_v3 } from 'googleapis';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';

@Injectable()
export class GoogleConverterService {
    convertToGoogleCalendarIntegration(
        googleCalendars: calendar_v3.Schema$CalendarList
    ): GoogleCalendarIntegration[] {
        const { items } = googleCalendars;

        return (items as calendar_v3.Schema$CalendarListEntry[]).map(
            (item) =>
                ({
                    name: item.id,
                    description: item.summary,
                    googleCalendarAccessRole: item.accessRole,
                    color: item.foregroundColor,
                    primary: item.primary || false,
                    raw: item
                } as GoogleCalendarIntegration)
        );
    }
}
