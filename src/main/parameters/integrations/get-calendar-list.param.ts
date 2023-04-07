import { IsEnum } from 'class-validator';
import { CalendarSearchOption } from '../../enums/integrations/calendar-search-option.enum';
export class GetCalendarListSearchOption {
    @IsEnum(CalendarSearchOption)
    accessRole: CalendarSearchOption;
}
