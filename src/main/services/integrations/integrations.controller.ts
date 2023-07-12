import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe } from '@nestjs/common';
import { AuthUser } from '@decorators/auth-user.decorator';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { Integration } from '@entity/integrations/integration.entity';

/**
 * Sign up with Google API is located on token controller.
 */
@Controller(':vendor')
export class IntegrationsController {
    constructor(
        private readonly googleIntegrationsService: GoogleIntegrationsService
    ) {}

    @Get()
    searchIntegrations(
        @AuthUser('id') userId: number,
        @Param('vendor') vendor: 'google' | 'zoom'
    ): Promise<Integration[]> {

        const integrationService = this.getService(vendor);
        return integrationService.search({ userId });
    }

    @Delete(':vendorIntegrationId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @AuthUser('id') userId: number,
        @Param('vendor') vendor: 'google' | 'zoom',
        @Param('vendorIntegrationId', ParseIntPipe) vendorIntegrationId: number
    ): Promise<void> {
        const integrationService = this.getService(vendor);
        await integrationService.remove(vendorIntegrationId, userId);
    }

    getService(vendor: string): GoogleIntegrationsService {

        let myService;
        switch (vendor) {
            case 'google':
                myService = this.googleIntegrationsService;
                break;
            case 'zoom':
            default:
                throw new BadRequestException('Not yet implemented');
        }

        return myService;
    }
}
