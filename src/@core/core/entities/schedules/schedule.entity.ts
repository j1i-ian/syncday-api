import { Column, Entity, Generated, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BufferTime } from '../events/buffer-time.entity';
import { EventType } from '../events/event-type.entity';
import { TimeRange } from '../events/time-range.entity';
import { EventDetail } from '../events/event-detail.entity';

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

    @Column({ name: 'event_detail_id' })
    eventDetailId: number;

    @ManyToOne(() => EventDetail, (eventDetail) => eventDetail, {
        onUpdate: 'NO ACTION',
        onDelete: 'NO ACTION'
    })
    @JoinColumn({ name: 'event_detail_id' })
    eventDetail: EventDetail;
}
