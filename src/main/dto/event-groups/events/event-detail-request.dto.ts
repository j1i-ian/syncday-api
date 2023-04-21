import { OmitType } from '@nestjs/mapped-types';
import { EventDetailDto } from './event-detail.dto';

export class EventDetailRequestDto extends OmitType(EventDetailDto, [
    'inviteeQuestionUUID',
    'remindersUUID'
]) {}
