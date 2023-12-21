import { GoogleIntegrationBody } from '@core/interfaces/integrations/google/google-integration-body.interface';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { CalendarCreateOption } from '@app/interfaces/integrations/calendar-create-option.interface';

export interface OAuth2MetaInfo {
    googleCalendarIntegrations: GoogleCalendarIntegration[];
    googleIntegrationBody: GoogleIntegrationBody;
    options: CalendarCreateOption;
}
