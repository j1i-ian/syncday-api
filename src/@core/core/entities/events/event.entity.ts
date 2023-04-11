import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import { Schedule } from '../schedules/schedule.entity';
import { BufferTime } from './buffer-time.entity';
import { EventType } from './event-type.entity';
import { EventGroup } from './evnet-group.entity';
import { TimeRange } from './time-range.entity';
import { EventStatus } from './event-status.enum';

@Entity()
export class Event {
    constructor(event?: Partial<Event>) {
        if (event) {
            Object.assign(this, event);
        }
    }

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        length: 200
    })
    name: string;

    @Column('enum', {
        enum: EventStatus
    })
    status: EventStatus;

    @Column('enum', {
        enum: EventType
    })
    eventType: EventType;

    @Column('time', {
        default: '00:00:00'
    })
    duration: string | number;

    @Column(() => BufferTime)
    bufferTime: BufferTime;

    @Column(() => TimeRange)
    timeRange: TimeRange;

    @Column()
    bookingUrl: string;

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

    @OneToMany(() => Schedule, (schedule) => schedule.event)
    schedule: Schedule[];

    @ManyToOne(() => EventGroup, (eventGroup) => eventGroup.events)
    @JoinColumn()
    eventGroup: EventGroup;
}
