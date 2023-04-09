import { IsEnum, IsOptional } from 'class-validator';
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
    dateTimeFormat?: Intl.DateTimeFormatOptions;

    @IsOptional()
    dateTimeOrderFormat?: string;

    @IsOptional()
    timezone?: string;
}
