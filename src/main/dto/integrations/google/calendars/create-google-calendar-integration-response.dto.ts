import { Expose, Type } from 'class-transformer';
import { IntegrationCalendarSettingDto } from '@dto/integrations/google/calendars/integration-calendar-setting.dto';

export class CreateGoogleCalendarIntegrationResponseDto {
    @Expose()
    id: number;

    @Expose()
    uuid: string;

    @Expose()
    subject: string;

    @Expose()
    @Type(() => IntegrationCalendarSettingDto)
    settings: IntegrationCalendarSettingDto;
}
