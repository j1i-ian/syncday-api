import { AvailableTime } from '@core/entities/availability/availability-time.entity';
import { OverridedAvailabilityTime } from '@core/entities/availability/overrided-availability-time.entity';

export interface AvailabilityBody {
    availableTimes: AvailableTime[];
    overrides: OverridedAvailabilityTime[];
}
