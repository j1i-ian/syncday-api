import { Expose, Type } from 'class-transformer';
import { IsArray, IsDefined, IsOptional, ValidateNested } from 'class-validator';
import { TimeRangeDto } from '../../datetime-presets/time-range.dto';
import { BufferTimeDto } from './buffer-time.dto';
import { ContactDto } from './contact.dto';
import { DateRangeDto } from './date-range.dto';
import { InviteeQuestionDto } from './invitee-question.dto';
import { ReminderDto } from './reminder.dto';

export class EventDetailDto {
    @IsOptional()
    @Expose()
    description: string;

    @IsArray()
    @Expose()
    @Type(() => ContactDto)
    @ValidateNested({ each: true })
    contacts: ContactDto[];

    @Type(() => BufferTimeDto)
    @Expose()
    bufferTime: BufferTimeDto;

    @Type(() => TimeRangeDto)
    @Expose()
    timeRange: TimeRangeDto;

    @IsDefined()
    @Expose()
    interval: string;

    @Type(() => DateRangeDto)
    @Expose()
    dateRange: DateRangeDto;

    @IsDefined()
    @Expose()
    inviteeQuestionUUID: string;

    @IsArray()
    @Expose()
    @Type(() => InviteeQuestionDto)
    @ValidateNested({ each: true })
    inviteeQuestions: InviteeQuestionDto[];

    @IsDefined()
    @Expose()
    remindersUUID: string;

    @Expose()
    @Type(() => ReminderDto)
    @ValidateNested({ each: true })
    reminders: ReminderDto[];
}
