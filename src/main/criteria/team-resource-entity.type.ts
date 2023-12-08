import { Availability } from '@entity/availability/availability.entity';
import { Event } from '@entity/events/event.entity';
import { EventGroup } from '@entity/events/event-group.entity';

export type TeamResourceEntity = Availability | EventGroup | Event;
