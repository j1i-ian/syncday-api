import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Generated,
    JoinColumn,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import { BufferTime } from './buffer-time.entity';
import { TimeRange } from './time-range.entity';
import { Event } from './event.entity';
import { Contact } from './contact.entity';
import { Reminder } from '../reminders/reminder.entity';
import { InviteeQuestion } from '../invitee-questions/invitee-question.entity';
import { Schedule } from '../schedules/schedule.entity';
import { DateRange } from './date-range.entity';

/**
 * @property {dateRange} After that date invitees can be booked, ex) '2023-01-01'
 */
@Entity()
export class EventDetail {
    constructor(eventDetail?: Partial<EventDetail>) {
        if (eventDetail) {
            Object.assign(this, eventDetail);
        }
    }

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable: true,
        default: null,
        length: 120
    })
    @Generated('uuid')
    uuid: string;

    @Column({ length: 1000, nullable: true, default: null })
    description: string;

    @Column('simple-json', {
        nullable: false
    })
    contacts: Contact[];

    @Column(() => BufferTime)
    bufferTime: BufferTime;

    @Column(() => TimeRange)
    timeRange: TimeRange;

    @Column(() => DateRange)
    dateRange: DateRange;

    @Column('time', {
        default: '00:00:00'
    })
    interval: string | number;

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

    @OneToMany(() => Schedule, (schedule) => schedule.eventDetail)
    schedules: Schedule;
    /**
     * this objects are patched from redis by logic
     */
    inviteeQuestions: InviteeQuestion[];

    /**
     * this objects are patched from redis by logic
     */
    reminders: Reminder[];
}
