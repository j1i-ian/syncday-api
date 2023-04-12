import { Expose, Type } from 'class-transformer';
import { IsArray, IsDateString, ValidateNested } from 'class-validator';
import { TimeRangeDto } from './time-range.dto';

export class CreateDatetimePresetOverrideRequestDto {
    @Expose()
    @IsDateString()
    targetDate: Date;

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimeRangeDto)
    timeRanges: TimeRangeDto[];
}
