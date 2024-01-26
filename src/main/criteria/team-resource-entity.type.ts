import { Availability } from '@entities/availability/availability.entity';
import { Event } from '@entities/events/event.entity';
import { EventGroup } from '@entities/events/event-group.entity';

export type TeamResourceEntity = Availability | EventGroup | Event;
