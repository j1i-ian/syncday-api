import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TimePresetDto } from './time-preset.dto';
import { CreateDatetimePresetOverrideRequestDto } from './create-datetime-preset-override-request.dto';

export class UpdateDatetimePresetRequestDto {
    @IsString()
    name: string;

    @IsString()
    timezone: string;

    @IsBoolean()
    default: boolean;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimePresetDto)
    timepreset: TimePresetDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDatetimePresetOverrideRequestDto)
    overrides: CreateDatetimePresetOverrideRequestDto[];
}
