import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Get, Delete } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthUser } from '@decorators/auth-user.decorator';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { DeleteGoogleCalendarIntegrationsRequest } from '@dto/integrations/google/delete-google-calendar-integrations.dto';

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
    patchGoogleCalendarIntegrations(
        @Param('vendor') vendor: string,
        @AuthUser('id') userId: number,
        @Body() googleCalendarIntegrations: GoogleCalendarIntegration[]
    ): Promise<boolean> {
        return this.googleCalendarIntegrationsService.patch(userId, googleCalendarIntegrations);
    }

    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    deleteGoogleCalendarIntegrations(
        @AuthUser('id') userId: number,
        @Body() deleteGoogleCalendarIntegrationsRequest: DeleteGoogleCalendarIntegrationsRequest
    ): Promise<boolean> {
        return this.googleCalendarIntegrationsService.removeByIntegrationId(
            userId,
            deleteGoogleCalendarIntegrationsRequest.googleIntegrationId
        );
    }
}
