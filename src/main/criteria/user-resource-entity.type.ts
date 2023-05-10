import { Availability } from '@entity/availability/availability.entity';
import { Event } from '@entity/events/event.entity';
import { EventGroup } from '@entity/events/evnet-group.entity';

export type UserResourceEntity = Availability | EventGroup | Event;
