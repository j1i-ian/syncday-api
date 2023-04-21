import { Type } from 'class-transformer';
import { EventDetailRequestDto } from './event-detail-request.dto';
import { EventRequestDto } from './event-request.dto';

export class CreateEventRequestDto extends EventRequestDto {
    @Type(() => EventDetailRequestDto)
    eventDetail: EventDetailRequestDto;
}
