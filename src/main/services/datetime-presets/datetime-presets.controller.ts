import { Body, Controller, Get, Param, ParseIntPipe, Post, SerializeOptions } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '@decorators/auth-user.decorator';
import { CreateDatetimePresetRequestDto } from '@dto/datetime-presets/create-datetime-preset-request.dto';
import { CreateDatetimePresetResponseDto } from '@dto/datetime-presets/create-datetime-preset-response.dto';
import { GetDatetimePresetsResponseDto } from '@dto/datetime-presets/get-datetime-presets-response.dto';
import { GetDatetimePresetResponseDto } from '@dto/datetime-presets/get-datetime-preset-response.dto';
import { AppJwtPayload } from '../../auth/strategy/jwt/app-jwt-payload.interface';
import { DatetimePresetsService } from './datetime-presets.service';

@Controller()
export class DatetimePresetsController {
    constructor(private readonly datetimePresetsService: DatetimePresetsService) {}

    @SerializeOptions({
        strategy: 'excludeAll',
        excludeExtraneousValues: true
    })
    @Post()
    async createDatetimePreset(
        @AuthUser() authUser: AppJwtPayload,
        @Body() createDatetimePresetRequestDto: CreateDatetimePresetRequestDto
    ): Promise<CreateDatetimePresetResponseDto> {
        const createdDatetimePreset = await this.datetimePresetsService.createDatetimePreset(
            authUser.id,
            createDatetimePresetRequestDto
        );

        return plainToInstance(CreateDatetimePresetResponseDto, createdDatetimePreset);
    }

    @SerializeOptions({
        strategy: 'excludeAll',
        excludeExtraneousValues: true
    })
    @Get()
    async getDatetimePresets(
        @AuthUser() authUser: AppJwtPayload
    ): Promise<GetDatetimePresetsResponseDto[]> {
        const datetimePresets = await this.datetimePresetsService.getDatetimePresets(authUser.id);

        return plainToInstance(GetDatetimePresetsResponseDto, datetimePresets);
    }

    @SerializeOptions({
        strategy: 'excludeAll',
        excludeExtraneousValues: true
    })
    @Get(':datetimePresetId(\\d+)')
    async getDatetimePreset(
        @AuthUser() authUser: AppJwtPayload,
        @Param('datetimePresetId', ParseIntPipe) datetimePresetId: number
    ): Promise<GetDatetimePresetResponseDto> {
        const datetimePreset = await this.datetimePresetsService.getDatetimePreset(
            authUser.id,
            datetimePresetId
        );
        return plainToInstance(GetDatetimePresetResponseDto, datetimePreset);
    }
}
