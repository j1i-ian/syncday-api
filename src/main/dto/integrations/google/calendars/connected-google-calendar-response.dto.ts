import { Expose, Type } from 'class-transformer';
import { IntegrationCalendarSettingDto } from '@dto/integrations/google/calendars/integration-calendar-setting.dto';

export class GetGoogleCalendarConnectionsResponseDto {
    @Expose()
    id: string;

    @Expose()
    uuid: string;

    @Expose()
    calendarId: string;

    @Expose()
    subject: string;

    @Expose()
    @Type(() => IntegrationCalendarSettingDto)
    settings: IntegrationCalendarSettingDto;
}
