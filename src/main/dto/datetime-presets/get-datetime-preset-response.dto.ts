import { Expose, Type } from 'class-transformer';
import { TimePresetDto } from './time-preset.dto';
import { CreateDatetimePresetOverrideRequestDto } from './create-datetime-preset-override-request.dto';

export class GetDatetimePresetResponseDto {
    @Expose()
    id: number;

    @Expose()
    uuid: string;

    @Expose()
    name: string;

    @Expose()
    @Type(() => TimePresetDto)
    timepreset: TimePresetDto[];

    @Expose()
    @Type(() => CreateDatetimePresetOverrideRequestDto)
    overrides: CreateDatetimePresetOverrideRequestDto[];
}
