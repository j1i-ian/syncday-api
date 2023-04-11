import { IsEnum } from 'class-validator';
import { CalendarSearchOption } from '../../enums/integrations/calendar-search-option.enum';
export class CalendarListSearchOption {
    @IsEnum(CalendarSearchOption)
    accessRole: CalendarSearchOption;
}
