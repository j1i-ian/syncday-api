import { Body, Controller, Get, Param, Post, Query, SerializeOptions } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '@decorators/auth-user.decorator';
import { GoogleCalendarIntegrationService } from '@services/integrations/calendars/google-calendar-integration.service';
import { CreateGoogleIntegrationDto } from '@dto/integrations/create-google-integration-request.dto';
import { CreateGoogleCalendarResponseDto } from '@dto/integrations/create-google-calendar-response.dto';
import { GetIntegrationCalendarListResponseDto } from '@dto/integrations/get-integration-calendar-list-response.dto';
import { AppJwtPayload } from '../../../auth/strategy/jwt/app-jwt-payload.interface';
import { GetCalendarListSearchOption } from '../../../parameters/integrations/get-calendar-list.param';

@Controller()
export class IntegrationCalendarsController {
    constructor(
        private readonly googleCalendarIntegrationService: GoogleCalendarIntegrationService
    ) {}

    @SerializeOptions({
        strategy: 'excludeAll',
        excludeExtraneousValues: true
    })
    @Post('google')
    async createGoogleCalendarIntegration(
        @AuthUser() authUser: AppJwtPayload,
        @Body() requestBody: CreateGoogleIntegrationDto
    ): Promise<CreateGoogleCalendarResponseDto> {
        const createdIntegration = await this.googleCalendarIntegrationService.createIntegration(
            authUser.id,
            requestBody
        );

        return plainToInstance(CreateGoogleCalendarResponseDto, createdIntegration);
    }

    @Get('google/:integrationId(\\d+)/list')
    async getGoogleCalendarList(
        @AuthUser() authUser: AppJwtPayload,
        @Query() query: GetCalendarListSearchOption,
        @Param('integrationId') integrationId: string
    ): Promise<GetIntegrationCalendarListResponseDto> {
        const calendarList = await this.googleCalendarIntegrationService.getCalendarList(
            authUser.id,
            +integrationId,
            query
        );

        return calendarList;
    }
}
