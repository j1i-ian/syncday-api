import { IsInt, IsString, ValidateNested } from 'class-validator';
import { IntegrationCalendarSettingDto } from '@dto/integrations/google/calendars/integration-calendar-setting.dto';

export class CreateGoogleCalendarIntegrationRequestDto {
    @IsString()
    calendarId: string;

    @IsString()
    subject: string;

    @ValidateNested()
    settings: IntegrationCalendarSettingDto;

    @IsInt()
    googleIntegrationId: number;
}
