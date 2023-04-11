import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    SerializeOptions
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '@decorators/auth-user.decorator';
import { GoogleCalendarIntegrationService } from '@services/integrations/calendars/google/google-calendar-integration.service';

import { CreateGoogleCalendarIntegrationRequestDto } from '@dto/integrations/google/calendars/create-google-calendar-integration-request.dto';
import { CreateGoogleCalendarIntegrationResponseDto } from '@dto/integrations/google/calendars/create-google-calendar-integration-response.dto';
import { CreateGoogleIntegrationDto } from '@dto/integrations/google/create-google-integration-request.dto';
import { CreateGoogleCalendarResponseDto } from '@dto/integrations/google/calendars/create-google-calendar-response.dto';
import { GetIntegrationCalendarListResponseDto } from '@dto/integrations/google/calendars/get-integration-calendar-list-response.dto';
import { UpdateGoogleCalendarIntegrationDto } from '@dto/integrations/google/calendars/update-google-calendar-integration-request.dto';
import { GetGoogleCalendarConnectionsResponseDto } from '@dto/integrations/google/calendars/connected-google-calendar-response.dto';
import { CalendarListSearchOption } from '../../../../parameters/integrations/get-calendar-list.param';
import { AppJwtPayload } from '../../../../auth/strategy/jwt/app-jwt-payload.interface';

@Controller()
export class GoogleCalendarsController {
    constructor(
        private readonly googleCalendarIntegrationService: GoogleCalendarIntegrationService
    ) {}

    /**
     * 구글 계정 연동.
     * 연동 정보를 생성하고, 해당 유저의 default 캘린더를 조회해 연동할 캘린더에 저장한다.
     */
    @SerializeOptions({
        strategy: 'excludeAll',
        excludeExtraneousValues: true
    })
    @Post()
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

    @Get(':integrationId(\\d+)/list')
    async getGoogleCalendarList(
        @AuthUser() authUser: AppJwtPayload,
        @Query() query: CalendarListSearchOption,
        @Param('integrationId') integrationId: string
    ): Promise<GetIntegrationCalendarListResponseDto> {
        const calendarList = await this.googleCalendarIntegrationService.getCalendarList(
            authUser.id,
            +integrationId,
            query
        );

        return calendarList;
    }

    @SerializeOptions({
        strategy: 'excludeAll',
        excludeExtraneousValues: true
    })
    @Get(':integrationId(\\d+)')
    async getGoogleCalendarConnections(
        @AuthUser() authUser: AppJwtPayload,
        @Query() query: CalendarListSearchOption,
        @Param('integrationId', new ParseIntPipe()) integrationId: number
    ): Promise<GetGoogleCalendarConnectionsResponseDto[]> {
        const result = await this.googleCalendarIntegrationService.getGoogleCalendarConnections(
            authUser.id,
            integrationId,
            query
        );

        return plainToInstance(GetGoogleCalendarConnectionsResponseDto, result);
    }

    /**
     * 연동할 캘린더를 생성한다.
     */
    @SerializeOptions({
        strategy: 'excludeAll',
        excludeExtraneousValues: true
    })
    @Post('google-calendar-integrations')
    async createGoogleCalendarConnection(
        @AuthUser() authUser: AppJwtPayload,
        @Body() body: CreateGoogleCalendarIntegrationRequestDto
    ): Promise<CreateGoogleCalendarIntegrationResponseDto> {
        const result = await this.googleCalendarIntegrationService.createGoogleCalendarConnection(
            authUser.id,
            body
        );

        return plainToInstance(CreateGoogleCalendarIntegrationResponseDto, result);
    }

    @Delete('google-calendar-integrations/:googleCalendarIntegrationId(\\d+)')
    async deleteGoogleCalendarConnection(
        @AuthUser() authUser: AppJwtPayload,
        @Param('googleCalendarIntegrationId', new ParseIntPipe())
        googleCalendarIntegrationId: number
    ): Promise<{ affected: boolean }> {
        const result = await this.googleCalendarIntegrationService.deleteGoogleCalendarConnection(
            authUser.id,
            googleCalendarIntegrationId
        );

        return result;
    }

    @Patch('google-calendar-integrations/:googleCalendarIntegrationId(\\d+)')
    async updateGoogleCalendarConnection(
        @AuthUser() authUser: AppJwtPayload,
        @Param('googleCalendarIntegrationId', new ParseIntPipe())
        googleCalendarIntegrationId: number,
        @Body() body: UpdateGoogleCalendarIntegrationDto
    ): Promise<{ affected?: boolean }> {
        const result = await this.googleCalendarIntegrationService.updateGoogleCalendarConnection(
            authUser.id,
            googleCalendarIntegrationId,
            body
        );

        return result;
    }
}
