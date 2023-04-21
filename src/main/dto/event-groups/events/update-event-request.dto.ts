import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { EventDetailOptinalRequestDto } from './event-detail-optional-request.dto';
import { EventRequestDto } from './event-request.dto';

export class UpdateEventRequestDto extends PartialType(EventRequestDto) {
    @Type(() => EventDetailOptinalRequestDto)
    eventDetail: EventDetailOptinalRequestDto;
}
