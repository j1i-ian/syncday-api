import { Expose } from 'class-transformer';
import { EventType } from '@entity/events/event-type.entity';
import { EventStatus } from '@entity/events/event-status.enum';

export class GetEventsResponseDto {
    @Expose()
    id: number;

    @Expose()
    uuid: string;

    @Expose()
    name: string;

    @Expose()
    type: EventType;

    @Expose()
    link: string;

    @Expose()
    createdAt: Date;

    @Expose()
    color: string;

    @Expose()
    status: EventStatus;

    @Expose()
    public: boolean;

    @Expose()
    duration: string | number;

    @Expose()
    maxParticipants: number;
}
