import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Generated,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import { EventType } from '../events/event-type.entity';
import { TimeRange } from '../events/time-range.entity';
import { EventDetail } from '../events/event-detail.entity';
import { ScheduleStatus } from './schedule-status.enum';
import { Contact } from '../events/contact.entity';
import { ScheduleBufferTime } from './schedule-buffer-time.entity';
import { InviteeAnswer } from './invitee-answer.entity';
import { ScheduleTimeset } from './schedule-timeset.entity';
import { ScheduledReminder } from './scheduled-reminder.entity';

/**
 * schedule is generated from event.
 *
 * @see {@link Event}
 */
@Entity()
export class Schedule {
    @PrimaryGeneratedColumn()
    id: number;

    @Generated('uuid')
    uuid: string;

    @Column({
        length: 200
    })
    name: string;

    @Column(() => TimeRange)
    timeRange: TimeRange;

    // unix epoch time
    @Column('timestamp')
    timestamp: number;

    @Column({ length: 1000 })
    meetingNote: string;

    @Column({
        default: 1
    })
    maxParticipants: number;

    @Column({
        default: 1
    })
    participants: number;

    @Column({
        default: '#000000',
        length: 10
    })
    color: string;

    /**
     * public false 를 위해 schedule link 에는 workspace/event/uuid 값으로 들어가야한다.
     */
    @Column()
    link: string;

    @Column('enum', {
        enum: ScheduleStatus
    })
    status: ScheduleStatus;

    @Column()
    statusDescription: string;

    @Column('simple-json', {
        nullable: false
    })
    contacts: Contact[];

    @Column('enum', {
        enum: EventType
    })
    type: EventType;

    @Column(() => ScheduleBufferTime)
    scheduleBufferTime: ScheduleBufferTime;

    @Column(() => ScheduleTimeset)
    scheduleTimepreset: ScheduleTimeset;

    @Column({
        default: true
    })
    public: boolean;

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

    @Column({ name: 'event_detail_id' })
    eventDetailId: number;

    @ManyToOne(() => EventDetail, (eventDetail) => eventDetail, {
        onUpdate: 'NO ACTION',
        onDelete: 'NO ACTION'
    })
    @JoinColumn({ name: 'event_detail_id' })
    eventDetail: EventDetail;

    /**
     * patched from redis with schedule UUID
     */
    scheduledReminders: ScheduledReminder[];

    /**
     * patched from redis with schedule UUID
     */
    inviteeAnswers: InviteeAnswer[];
}
