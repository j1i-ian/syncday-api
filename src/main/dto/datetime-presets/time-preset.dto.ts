import { IsArray, IsEnum, ValidateNested } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { DayWeek } from '@entity/datetime-presets/day-week.enum';
import { TimeRangeDto } from './time-range.dto';

export class TimePresetDto {
    @Expose()
    @IsEnum(DayWeek)
    day: DayWeek;

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimeRangeDto)
    timeRanges: TimeRangeDto[];
}
