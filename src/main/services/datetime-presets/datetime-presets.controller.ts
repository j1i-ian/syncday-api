import {
    All,
    Body,
    Controller,
    Delete,
    Get,
    Header,
    HttpCode,
    HttpStatus,
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
import { CreateDatetimePresetRequestDto } from '@dto/datetime-presets/create-datetime-preset-request.dto';
import { CreateDatetimePresetResponseDto } from '@dto/datetime-presets/create-datetime-preset-response.dto';
import { GetDatetimePresetsResponseDto } from '@dto/datetime-presets/get-datetime-presets-response.dto';
import { GetDatetimePresetResponseDto } from '@dto/datetime-presets/get-datetime-preset-response.dto';
import { UpdateDatetimePresetRequestDto } from '@dto/datetime-presets/update-datetime-preset-request.dto';
import { AppJwtPayload } from '../../auth/strategy/jwt/app-jwt-payload.interface';
import { HttpMethod } from '../../enums/http-method.enum';
import { MatrixParameter } from '../../decorators/matrix-parameter.decorator';
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
        const datetimePresets = await this.datetimePresetsService.getDatetimePresets(
            authUser.id,
            authUser.uuid
        );

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
            authUser.uuid,
            datetimePresetId
        );
        return plainToInstance(GetDatetimePresetResponseDto, datetimePreset);
    }

    @Header('Content-type', 'application/json')
    @Put(':datetimePresetId(\\d+)')
    async updateDatetimePreset(
        @AuthUser() authUser: AppJwtPayload,
        @Param('datetimePresetId', new ParseIntPipe()) datetimePresetId: number,
        @Body() updateDateTimePresetRequestDto: UpdateDatetimePresetRequestDto
    ): Promise<boolean> {
        const updateResult = await this.datetimePresetsService.updateDatetimePreset(
            authUser.id,
            authUser.uuid,
            datetimePresetId,
            updateDateTimePresetRequestDto
        );

        return updateResult;
    }

    @Delete(':datetimePresetId(\\d+)')
    async deleteDatetimePreset(
        @AuthUser() authUser: AppJwtPayload,
        @Param('datetimePresetId', new ParseIntPipe()) datetimePresetId: number
    ): Promise<boolean> {
        const deleteResult = await this.datetimePresetsService.deleteDatetimePreset(
            authUser.id,
            datetimePresetId
        );

        return deleteResult;
    }

    @Header('Content-type', 'application/json')
    @HttpCode(HttpStatus.NO_CONTENT)
    @All(':datetimePresetId(\\d+);:matrixVariables((eventId=\\d+;?)+)')
    async HttpMethodLocator(
        @AuthUser() authUser: AppJwtPayload,
        @Param('datetimePresetId', new ParseIntPipe()) datetimePresetId: number,
        @MatrixParameter() matrixParameter: { [key: string]: string[] },
        @Req() req: Request
    ): Promise<boolean> {
        let result: boolean;

        switch (req.method) {
            case HttpMethod.LINK:
                const linkResult = await this.linkDatetimePresetWithEvents({
                    userId: authUser.id,
                    datetimePresetId,
                    eventIdStrArray: matrixParameter.eventId
                });

                result = linkResult;
                break;
            case HttpMethod.UNLINK:
                const unlinkResult = await this.unlinkDatetimePresetWithEvents({
                    userId: authUser.id,
                    datetimePresetId,
                    eventIdStrArray: matrixParameter.eventId
                });

                result = unlinkResult;
                break;
            default:
                throw new NotFoundException(`Cannot ${req.method} ${req.path}`);
        }

        return result;
    }

    async linkDatetimePresetWithEvents({
        userId,
        datetimePresetId,
        eventIdStrArray
    }: {
        userId: number;
        datetimePresetId: number;
        eventIdStrArray: string[];
    }): Promise<boolean> {
        const linkResult = await this.datetimePresetsService.linkDatetimePresetWithEvents(
            userId,
            datetimePresetId,
            eventIdStrArray
        );

        return linkResult;
    }

    async unlinkDatetimePresetWithEvents({
        userId,
        datetimePresetId,
        eventIdStrArray
    }: {
        userId: number;
        datetimePresetId: number;
        eventIdStrArray: string[];
    }): Promise<boolean> {
        const unlinkResult = await this.datetimePresetsService.unlinkDatetimePresetWithEvents(
            userId,
            datetimePresetId,
            eventIdStrArray
        );

        return unlinkResult;
    }
}
