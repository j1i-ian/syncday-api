import { Expose } from 'class-transformer';
import { Language } from '../../enums/language.enum';
import { IntegrationsInfo } from '../../services/users/interfaces/integrations-info.interface';

export class FetchUserInfoResponseDto {
    @Expose()
    name: string;

    @Expose()
    link: string;

    @Expose()
    greetings: string;

    @Expose()
    language: Language;

    @Expose()
    dateTimeFormat: Intl.DateTimeFormatOptions;

    @Expose()
    dateTimeOrderFormat: string;

    @Expose()
    timezone: string;

    @Expose()
    integration: IntegrationsInfo;
}
