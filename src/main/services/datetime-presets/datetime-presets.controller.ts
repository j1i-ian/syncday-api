import {
    All,
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Req,
    SerializeOptions
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Request } from 'express';
import { AuthUser } from '@decorators/auth-user.decorator';
import { LinkHeader } from '@decorators/link-header.decorator';
import { CreateDatetimePresetRequestDto } from '@dto/datetime-presets/create-datetime-preset-request.dto';
import { CreateDatetimePresetResponseDto } from '@dto/datetime-presets/create-datetime-preset-response.dto';
import { GetDatetimePresetsResponseDto } from '@dto/datetime-presets/get-datetime-presets-response.dto';
import { GetDatetimePresetResponseDto } from '@dto/datetime-presets/get-datetime-preset-response.dto';
import { UpdateDatetimePresetRequestDto } from '@dto/datetime-presets/update-datetime-preset-request.dto';
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
        @Param('datetimePresetId', new ParseIntPipe()) datetimePresetId: number
    ): Promise<GetDatetimePresetResponseDto> {
        const datetimePreset = await this.datetimePresetsService.getDatetimePreset(
            authUser.id,
            datetimePresetId
        );
        return plainToInstance(GetDatetimePresetResponseDto, datetimePreset);
    }

    @Put(':datetimePresetId(\\d+)')
    async updateDatetimePreset(
        @AuthUser() authUser: AppJwtPayload,
        @Param('datetimePresetId', new ParseIntPipe()) datetimePresetId: number,
        @Body() updateDateTimePresetRequestDto: UpdateDatetimePresetRequestDto
    ): Promise<{
        affected: boolean;
    }> {
        const updateResult = await this.datetimePresetsService.updateDatetimePreset(
            authUser.id,
            datetimePresetId,
            updateDateTimePresetRequestDto
        );

        return updateResult;
    }

    @Delete(':datetimePresetId(\\d+)')
    async deleteDatetimePreset(
        @AuthUser() authUser: AppJwtPayload,
        @Param('datetimePresetId', new ParseIntPipe()) datetimePresetId: number
    ): Promise<{
        affected: boolean;
    }> {
        const deleteResult = await this.datetimePresetsService.deleteDatetimePreset(
            authUser.id,
            datetimePresetId
        );

        return deleteResult;
    }

    @All(':datetimePresetId(\\d+)')
    async handleDatetimePresetLink(
        @AuthUser() authUser: AppJwtPayload,
        @Param('datetimePresetId', new ParseIntPipe()) datetimePresetId: number,
        @Req() req: Request,
        @LinkHeader() parsedLink: { [key: string]: string[] }
    ): Promise<{ affected: boolean }> {
        switch (req.method) {
            case 'LINK':
                const linkResult = await this.datetimePresetsService.linkDatetimePresetWithEvents(
                    authUser.id,
                    datetimePresetId,
                    parsedLink
                );

                return linkResult;
            case 'UNLINK':
                const unlinkResult =
                    await this.datetimePresetsService.unlinkDatetimePresetWithEvents(
                        authUser.id,
                        datetimePresetId,
                        parsedLink
                    );

                return unlinkResult;
            default:
                throw new NotFoundException(`Cannot ${req.method} ${req.path}`);
        }
    }
}
