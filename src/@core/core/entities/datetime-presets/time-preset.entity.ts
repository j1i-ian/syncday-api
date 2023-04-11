import { TimeRange } from '../events/time-range.entity';
import { DayWeek } from './day-week.enum';

export class TimePreset {
    /**
     * @property {number} day javascript day value
     */
    day: DayWeek;

    timeRanges: TimeRange[];
}
