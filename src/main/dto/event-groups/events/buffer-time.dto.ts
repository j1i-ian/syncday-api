import { Expose } from 'class-transformer';
import { IsDefined } from 'class-validator';

export class BufferTimeDto {
    @IsDefined()
    @Expose()
    before: string;

    @IsDefined()
    @Expose()
    after: string;
}
