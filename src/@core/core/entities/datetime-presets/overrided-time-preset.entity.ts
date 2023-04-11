import { TimeRange } from '../events/time-range.entity';

export class OverridedTimePreset {
    /**
     * Proceed in ISO 8601 format, but convert to unix epoch if there is a problem in the middle.
     */
    targetDate: Date;

    timeRanges: TimeRange[];
}
