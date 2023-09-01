import { BadRequestException, Injectable } from '@nestjs/common';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { IntegrationsFacade } from '@services/integrations/integrations.facade.interface';
import { IntegrationsServiceInterface } from '@services/integrations/integrations.service.interface';
import { ZoomIntegrationFacade } from '@services/integrations/zoom-integrations/zoom-integrations.facade';
import { ZoomIntegrationsService } from '@services/integrations/zoom-integrations/zoom-integrations.service';

@Injectable()
export class IntegrationsServiceLocator {

    constructor(
        private readonly googleIntegrationsService: GoogleIntegrationsService,
        private readonly zoomIntegrationsService: ZoomIntegrationsService,
        private readonly googleIntegrationFacade: GoogleIntegrationFacade,
        private readonly zoomIntegrationFacade: ZoomIntegrationFacade
    ) {}

    getService(vendor: string): IntegrationsServiceInterface {

        let myService;
        switch (vendor) {
            case 'google':
                myService = this.googleIntegrationsService;
                break;
            case 'zoom':
                myService = this.zoomIntegrationsService;
                break;
            default:
                throw new BadRequestException('Not yet implemented');
        }

        return myService;
    }

    getFacade(vendor: string): IntegrationsFacade {

        let myFacade;
        switch (vendor) {
            case 'google':
                myFacade = this.googleIntegrationFacade;
                break;
            case 'zoom':
                myFacade = this.zoomIntegrationFacade;
                break;
            default:
                throw new BadRequestException('Not yet implemented');
        }

        return myFacade;
    }
}
