import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class TimeRangeDto {
    @Expose()
    @IsString()
    startTime: string | number;

    @Expose()
    @IsString()
    endTime: string | number;
}
