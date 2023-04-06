import { IsDefined, IsEnum } from 'class-validator';
import { Language } from '../../enums/language.enum';

export class UpdateUserSettingRequestDto {
    @IsDefined()
    name: string;

    @IsDefined()
    greetings: string;

    @IsDefined()
    @IsEnum(Language)
    language: Language;

    @IsDefined()
    dateTimeFormat: Intl.DateTimeFormatOptions;

    @IsDefined()
    dateTimeOrderFormat: string;

    @IsDefined()
    timeZone: string;
}
