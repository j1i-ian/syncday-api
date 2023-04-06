import { IsDefined } from 'class-validator';

export class UpdateUserSettingRequestDto {
    @IsDefined()
    name: string;

    @IsDefined()
    greetings: string;

    @IsDefined()
    language: string;

    @IsDefined()
    dateTimeFormat: Intl.DateTimeFormatOptions;

    @IsDefined()
    dateTimeOrderFormat: string;

    @IsDefined()
    timeZone: string;
}
