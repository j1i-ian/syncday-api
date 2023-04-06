import { Body, Controller, Post, SerializeOptions } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '@decorators/auth-user.decorator';
import { CreateGoogleIntegrationDto } from '@dto/integrations/create-google-integration-request.dto';
import { CreateGoogleCalendarResponseDto } from '@dto/integrations/create-google-calendar-response.dto';
import { AppJwtPayload } from '../../../auth/strategy/jwt/app-jwt-payload.interface';
import { GoogleCalendarService } from './google-calendar.service';

@Controller()
export class CalendarsController {
    constructor(private readonly googleCalendarService: GoogleCalendarService) {}

    @SerializeOptions({
        strategy: 'excludeAll',
        excludeExtraneousValues: true
    })
    @Post('google')
    async createGoogleCalendarIntegration(
        @AuthUser() authUser: AppJwtPayload,
        @Body() requestBody: CreateGoogleIntegrationDto
    ): Promise<CreateGoogleCalendarResponseDto> {
        const createdIntegration = await this.googleCalendarService.createIntegration(
            authUser.id,
            requestBody
        );

        return plainToInstance(CreateGoogleCalendarResponseDto, createdIntegration);
    }
}
