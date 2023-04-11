import { ValidateNested } from 'class-validator';
import { IntegrationCalendarSettingDto } from '@dto/integrations/google/calendars/integration-calendar-setting.dto';

export class UpdateGoogleCalendarIntegrationDto {
    @ValidateNested()
    settings: Partial<IntegrationCalendarSettingDto>;
}
