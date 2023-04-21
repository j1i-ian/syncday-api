import { PartialType } from '@nestjs/mapped-types';
import { EventDetailRequestDto } from './event-detail-request.dto';

export class EventDetailOptinalRequestDto extends PartialType(EventDetailRequestDto) {}
