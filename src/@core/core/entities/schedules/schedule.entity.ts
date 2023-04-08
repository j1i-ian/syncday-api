import { Column, Entity, Generated, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BufferTime } from '../events/buffer-time.entity';
import { EventType } from '../events/event-type.entity';
import { Event } from '../events/event.entity';

/**
 * schedule is generated from event.
 */
@Entity()
export class Schedule {
    @PrimaryGeneratedColumn()
    id: number;

    @Generated('uuid')
    uuid: string;

    @Column('enum', {
        enum: EventType
    })
    type: EventType;

    @Column(() => BufferTime)
    bufferTime: BufferTime;

    @ManyToOne(() => Event, (event) => event.eventGroup, {
        onUpdate: 'NO ACTION',
        onDelete: 'NO ACTION'
    })
    @JoinColumn()
    event: Event;
}
