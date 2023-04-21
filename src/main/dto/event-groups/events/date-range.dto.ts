import { Expose } from 'class-transformer';
import { IsDefined } from 'class-validator';

export class DateRangeDto {
    @IsDefined()
    @Expose()
    before: string;
}
