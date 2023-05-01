import { IsEnum, IsOptional } from 'class-validator';
import { DateTimeOrderFormat } from '@entity/users/date-time-format-order.enum';
import { DateTimeFormatOption } from '@entity/users/date-time-format-option.type';
import { Language } from '../../enums/language.enum';

export class UpdateUserSettingRequestDto {
    @IsOptional()
    name?: string;

    @IsOptional()
    link?: string;

    @IsOptional()
    greetings?: string;

    @IsEnum(Language)
    @IsOptional()
    language?: Language;

    @IsOptional()
    dateTimeFormat?: DateTimeFormatOption;

    @IsOptional()
    @IsEnum(DateTimeOrderFormat)
    dateTimeOrderFormat?: DateTimeOrderFormat[];

    @IsOptional()
    timezone?: string;
}
