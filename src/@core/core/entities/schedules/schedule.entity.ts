import { Column, Entity, Generated, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BufferTime } from '../events/buffer-time.entity';
import { EventType } from '../events/event-type.entity';
import { Event } from '../events/event.entity';
import { TimeRange } from '../events/time-range.entity';

/**
 * schedule is generated from event.
 */
@Entity()
export class Schedule {
    @PrimaryGeneratedColumn()
    id: number;

    @Generated('uuid')
    uuid: string;

    @Column(() => TimeRange)
    timeRange: TimeRange;

    // unix epoch time
    @Column('timestamp')
    timestamp: number;

    @Column('enum', {
        enum: EventType
    })
    type: EventType;

    @Column(() => BufferTime)
    bufferTime: BufferTime;

    @Column({
        default: true
    })
    public: boolean;

    @ManyToOne(() => Event, (event) => event.eventGroup, {
        onUpdate: 'NO ACTION',
        onDelete: 'NO ACTION'
    })
    @JoinColumn()
    event: Event;
}
