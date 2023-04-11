import { Expose } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class IntegrationCalendarSettingDto {
    @IsBoolean()
    @Expose()
    readSynchronize: boolean;

    @IsBoolean()
    @Expose()
    writeSynchronize: boolean;

    @IsBoolean()
    @Expose()
    deleteSynchronize: boolean;
}
