import { ZoomMonthlyWeekDay } from '../enum/monthly-week-day.enum';
import { ZoomMonthlyWeek } from '../enum/monthly-week.enum';
import { RecurrenceCycle } from '../enum/recurrence-cycle.enum';

export interface Recurrence {
    end_date_time: Date;
    /**
     * 1 ~ 365
     */
    end_times: number;
    /**
     * 1~31
     */
    monthly_day: number;
    monthly_week: ZoomMonthlyWeek;
    monthly_week_day: ZoomMonthlyWeekDay;
    repeat_interval: number;
    type: RecurrenceCycle;
    weekly_days: ZoomMonthlyWeekDay;
}
