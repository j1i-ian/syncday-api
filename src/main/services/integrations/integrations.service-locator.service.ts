import { BadRequestException, Injectable } from '@nestjs/common';
import { IntegrationSchedulesService } from '@core/interfaces/integrations/integration-schedules.abstract-service';
import { CalendarIntegrationService } from '@core/interfaces/integrations/calendar-integration.abstract-service';
import { ConferenceLinkIntegrationService } from '@core/interfaces/integrations/conference-link-integration.abstract-service';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { IntegrationsFacade } from '@services/integrations/integrations.facade.interface';
import { IntegrationsFactory } from '@services/integrations/integrations.factory.interface';
import { ZoomIntegrationFacade } from '@services/integrations/zoom-integrations/zoom-integrations.facade';
import { ZoomIntegrationsService } from '@services/integrations/zoom-integrations/zoom-integrations.service';
import { AppleIntegrationsService } from '@services/integrations/apple-integrations/apple-integrations.service';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';

@Injectable()
export class IntegrationsServiceLocator {

    constructor(
        private readonly calendarIntegrationsServiceLocator: CalendarIntegrationsServiceLocator,
        private readonly googleIntegrationsService: GoogleIntegrationsService,
        private readonly zoomIntegrationsService: ZoomIntegrationsService,
        private readonly appleIntegrationService: AppleIntegrationsService,
        private readonly googleIntegrationFacade: GoogleIntegrationFacade,
        private readonly zoomIntegrationFacade: ZoomIntegrationFacade
    ) {}

    getIntegrationFactory(vendor: IntegrationVendor): IntegrationsFactory {

        let myService;
        switch (vendor) {
            case IntegrationVendor.GOOGLE:
                myService = this.googleIntegrationsService;
                break;
            case IntegrationVendor.ZOOM:
                myService = this.zoomIntegrationsService;
                break;
            case IntegrationVendor.APPLE:
                myService = this.appleIntegrationService;
                break;
            default:
                throw new BadRequestException('Not yet implemented');
        }

        return myService;
    }

    getCalendarIntegrationService(vendor: IntegrationVendor): CalendarIntegrationService {
        return this.calendarIntegrationsServiceLocator.getCalendarIntegrationService(vendor);
    }

    getFacade(vendor: IntegrationVendor): IntegrationsFacade {

        let myFacade;
        switch (vendor) {
            case IntegrationVendor.GOOGLE:
                myFacade = this.googleIntegrationFacade;
                break;
            case IntegrationVendor.ZOOM:
                myFacade = this.zoomIntegrationFacade;
                break;
            case IntegrationVendor.APPLE:
            default:
                throw new BadRequestException('Not yet implemented');
        }

        return myFacade;
    }

    getAllIntegrationSchedulesService(): IntegrationSchedulesService[] {

        return [
            this.googleIntegrationsService.getIntegrationSchedulesService(),
            this.appleIntegrationService.getIntegrationSchedulesService()
        ];
    }

    getAllConferenceLinkIntegrationService(): ConferenceLinkIntegrationService[] {
        return [
            this.googleIntegrationsService.getConferenceLinkIntegrationService(),
            this.zoomIntegrationsService.getConferenceLinkIntegrationService()
        ];
    }
}
