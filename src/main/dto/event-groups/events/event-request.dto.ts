import { OmitType } from '@nestjs/mapped-types';
import { EventDto } from './event.dto';

export class EventRequestDto extends OmitType(EventDto, ['id', 'uuid']) {}
