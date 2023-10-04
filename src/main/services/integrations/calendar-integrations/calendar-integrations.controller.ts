import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Get } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthUser } from '@decorators/auth-user.decorator';
import { CalendarIntegration } from '@interfaces/integrations/calendar-integration.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';

@Controller(':vendor')
export class CalendarIntegrationsController {
    constructor(
        private readonly calendarIntegrationsServiceLocator: CalendarIntegrationsServiceLocator
    ) {}

    @Get()
    searchGoogleCalendarIntegrations(
        @AuthUser('id') userId: number,
        @Param('vendor') vendor: IntegrationVendor
    ): Observable<CalendarIntegration[]> {

        const calendarIntegrationsService = this.calendarIntegrationsServiceLocator.getCalendarIntegrationService(vendor);

        return calendarIntegrationsService.search({
            userId
        });
    }

    @Patch()
    @HttpCode(HttpStatus.NO_CONTENT)
    patchCalendarIntegrations(
        @Param('vendor') vendor: IntegrationVendor,
        @AuthUser('id') userId: number,
        @Body() calendarIntegrations: CalendarIntegration[]
    ): Promise<boolean> {

        const calendarIntegrationsService = this.calendarIntegrationsServiceLocator.getCalendarIntegrationService(vendor);

        return calendarIntegrationsService.patch(userId, calendarIntegrations);
    }
}
