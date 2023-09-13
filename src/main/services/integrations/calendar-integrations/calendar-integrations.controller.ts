import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Get } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthUser } from '@decorators/auth-user.decorator';
import { CalendarIntegration } from '@interfaces/integrations/calendar-integration.interface';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';

@Controller(':vendor')
export class CalendarIntegrationsController {
    constructor(
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService
    ) {}

    @Get()
    searchGoogleCalendarIntegrations(
        @AuthUser('id') userId: number
    ): Observable<GoogleCalendarIntegration[]> {
        return this.googleCalendarIntegrationsService.search({
            userId
        });
    }

    @Patch()
    @HttpCode(HttpStatus.NO_CONTENT)
    patchCalendarIntegrations(
        @Param('vendor') vendor: string,
        @AuthUser('id') userId: number,
        @Body() calendarIntegrations: CalendarIntegration[]
    ): Promise<boolean> {
        return this.googleCalendarIntegrationsService.patch(userId, calendarIntegrations);
    }
}
