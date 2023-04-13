import { IsEnum, IsOptional } from 'class-validator';
import { DateTimeOrderFormat } from '../../../@core/core/entities/users/date-time-format-order.enum';
import { Language } from '../../enums/language.enum';
import { DateTimeFormatOption } from '../../../@core/core/entities/users/date-time-format-option.type';

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
