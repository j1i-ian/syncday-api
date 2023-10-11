import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Logger, Param, Patch } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '@decorators/auth-user.decorator';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { CalendarIntegration } from '@interfaces/integrations/calendar-integration.interface';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { CalendarIntegrationResponseDto } from '@dto/integrations/calendar-integration-response.dto';

@Controller(`:vendor((${Object.values(IntegrationVendor).join('|')}))`)
export class VendorCalendarIntegrationsController {

    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly calendarIntegrationsServiceLocator: CalendarIntegrationsServiceLocator
    ) {}

    @Get()
    searchCalendarIntegrations(
        @AuthUser('id') userId: number,
        @Param('vendor') vendor: IntegrationVendor
    ): Observable<CalendarIntegration[]> {

        const calendarIntegrationsService = this.calendarIntegrationsServiceLocator.getCalendarIntegrationService(vendor);

        return calendarIntegrationsService.search({
            userId
        }).pipe(
            map((_calendarIntegrations) => _calendarIntegrations.map(
                (__calendarIntegration) =>
                    plainToInstance(CalendarIntegrationResponseDto, __calendarIntegration, {
                        excludeExtraneousValues: true
                    })
            ))
        );
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
