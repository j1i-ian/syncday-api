import { Expose } from 'class-transformer';
import { IsDefined, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { EventType } from '@entity/events/event-type.entity';

export class EventDto {
    @IsDefined()
    @Expose()
    uuid: string;

    @IsNumber()
    @Expose()
    id: number;

    @IsDefined()
    @Expose()
    name: string;

    @IsEnum(EventType)
    @IsDefined()
    @Expose()
    type: EventType;

    @IsDefined()
    @Expose()
    link: string;

    @IsDefined()
    @Expose()
    color: string;

    @IsDefined()
    @Expose()
    duration: string;

    /**
     * this is requied when EventType is ONE_ON_GROUP
     */
    @IsNumber()
    @IsOptional()
    @Expose()
    maxDailyScheduleCount: number;

    /**
     * this is requied when EventType is ONE_ON_GROUP
     */
    @IsNumber()
    @IsOptional()
    @Expose()
    maxParticipants: number;
}
