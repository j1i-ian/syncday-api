import { IsEnum, IsOptional } from 'class-validator';
import { EventStatus } from '@entity/events/event-status.enum';
export class GetEventsSearchOptions {
    @IsOptional()
    @IsEnum(EventStatus)
    status?: EventStatus;
}
