import { Controller, Get, SerializeOptions } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '@decorators/auth-user.decorator';
import { GetGoogleIntegrationsResponseDto } from '@dto/integrations/google/get-google-integrations-response.dto';
import { AppJwtPayload } from '../../auth/strategy/jwt/app-jwt-payload.interface';
import { GoogleIntegrationsService } from './google-integrations.service';

@Controller()
export class IntegrationsController {
    constructor(private readonly googleIntegrationsService: GoogleIntegrationsService) {}

    @SerializeOptions({
        strategy: 'excludeAll',
        excludeExtraneousValues: true
    })
    @Get('google')
    async getGoogleIntegrations(
        @AuthUser() authUser: AppJwtPayload
    ): Promise<GetGoogleIntegrationsResponseDto[]> {
        const googleIntegrations = await this.googleIntegrationsService.getGoogleIntegrations(
            authUser.id
        );

        return plainToInstance(GetGoogleIntegrationsResponseDto, googleIntegrations);
    }
}
