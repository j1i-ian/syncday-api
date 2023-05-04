import { IsEnum, IsOptional } from 'class-validator';
import { DateTimeOrderFormat } from '@entity/users/date-time-format-order.enum';
import { DateTimeFormatOption } from '@entity/users/date-time-format-option.type';
import { Language } from '../../enums/language.enum';

export class UpdateUserSettingRequestDto {
    @IsOptional()
    name?: string;

    @IsOptional()
    greetings?: string;

    @IsEnum(Language)
    @IsOptional()
    preferredLanguage?: Language;

    @IsOptional()
    preferredTimezone?: string;

    @IsOptional()
    preferredDateTimeFormat?: DateTimeFormatOption;

    @IsOptional()
    @IsEnum(DateTimeOrderFormat)
    preferredDateTimeOrderFormat?: DateTimeOrderFormat[];

    @IsOptional()
    workspace?: string;
}
