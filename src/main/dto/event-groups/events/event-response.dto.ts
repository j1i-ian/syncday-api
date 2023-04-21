import { Expose, Type } from 'class-transformer';
import { EventDetailDto } from './event-detail.dto';
import { EventDto } from './event.dto';

export class EventResponseDto extends EventDto {
    @Type(() => EventDetailDto)
    @Expose()
    eventDetail: EventDetailDto;
}
