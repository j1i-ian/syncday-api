import { Expose, Type } from 'class-transformer';
import { TimePresetDto } from './time-preset.dto';
import { CreateDatetimePresetOverrideRequestDto } from './create-datetime-preset-override-request.dto';

export class CreateDatetimePresetResponseDto {
    @Expose()
    uuid: string;

    @Expose()
    id: number;

    @Expose()
    name: string;

    @Expose()
    @Type(() => TimePresetDto)
    timepreset: TimePresetDto[];

    @Expose()
    @Type(() => CreateDatetimePresetOverrideRequestDto)
    overrides: CreateDatetimePresetOverrideRequestDto[];
}
