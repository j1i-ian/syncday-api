import { Expose } from 'class-transformer';
import { IsDefined, IsEnum, IsOptional } from 'class-validator';
import { ReminderTarget } from '../../../../@core/core/entities/reminders/reminder-target.enum';
import { ReminderType } from '../../../../@core/core/entities/reminders/reminder-type.enum';

export class ReminderDto {
    @IsOptional()
    @Expose()
    uuid: string;

    @IsDefined()
    @IsEnum(ReminderType)
    @Expose()
    type: ReminderType;

    @IsDefined()
    @IsEnum(ReminderTarget)
    @Expose()
    target: ReminderTarget;

    @IsDefined()
    @Expose()
    remindBefore: string;
}
