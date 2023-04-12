import { Body, Controller, Post, SerializeOptions } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '@decorators/auth-user.decorator';
import { CreateDatetimePresetRequestDto } from '@dto/datetime-presets/create-datetime-preset-request.dto';
import { CreateDatetimePresetResponseDto } from '@dto/datetime-presets/create-datetime-preset-response.dto';
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
}
