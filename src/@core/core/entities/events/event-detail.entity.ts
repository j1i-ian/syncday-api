import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Generated,
    JoinColumn,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import { BufferTime } from './buffer-time.entity';
import { TimeRange } from './time-range.entity';
import { Event } from './event.entity';

@Entity()
export class EventDetail {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable: true,
        default: null,
        length: 120
    })
    @Generated('uuid')
    uuid: string;

    @Column(() => BufferTime)
    bufferTime: BufferTime;

    @Column(() => TimeRange)
    timeRange: TimeRange;

    @CreateDateColumn({
        type: 'timestamp'
    })
    createdAt: Date;

    @UpdateDateColumn({
        type: 'timestamp'
    })
    updatedAt: Date;

    @DeleteDateColumn({
        type: 'timestamp'
    })
    deletedAt: Date;

    @Column({ name: 'event_id' })
    eventId: number;

    @OneToOne(() => Event)
    @JoinColumn({ name: 'event_id' })
    event: Event;
}
