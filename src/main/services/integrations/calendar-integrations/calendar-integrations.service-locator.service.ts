import { BadRequestException, Injectable } from '@nestjs/common';
import { CalendarIntegrationService } from '@interfaces/integrations/calendar-integration.abstract-service';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { AppleCalendarIntegrationsService } from '@services/integrations/apple-integrations/apple-calendar-integrations/apple-calendar-integrations.service';

@Injectable()
export class CalendarIntegrationsServiceLocator {

    constructor(
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService,
        private readonly appleCalendarIntegrationsService: AppleCalendarIntegrationsService
    ) {}

    getCalendarIntegrationService(vendor: IntegrationVendor): CalendarIntegrationService {

        let myService;

        switch (vendor) {
            case IntegrationVendor.GOOGLE:
                myService = this.googleCalendarIntegrationsService;
                break;
            case IntegrationVendor.APPLE:
                myService = this.appleCalendarIntegrationsService;
                break;
            case IntegrationVendor.ZOOM:
            default:
                throw new BadRequestException('Unsupported Vendor');
        }

        return myService;
    }

    getAllCalendarIntegrationServices(): CalendarIntegrationService[] {
        return [
            this.googleCalendarIntegrationsService,
            this.appleCalendarIntegrationsService
        ];
    }
}
