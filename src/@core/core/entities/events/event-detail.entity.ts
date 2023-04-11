import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Generated,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import { BufferTime } from './buffer-time.entity';
import { TimeRange } from './time-range.entity';
import { Event } from './event.entity';
import { Contact } from './contact.entity';
import { DatetimePreset } from '../datetime-presets/datetime-preset.entity';

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

    @Column({ length: 1000 })
    description: string;

    @Column({ length: 1000 })
    meetingNote: string;

    @Column('simple-json', {
        nullable: false
    })
    contacts: Contact[];

    @Column(() => BufferTime)
    bufferTime: BufferTime;

    @Column(() => TimeRange)
    timeRange: TimeRange;

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

    @Column({ name: 'datetime_preset_id' })
    datetimePresetId: number;

    @OneToOne(() => Event)
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @ManyToOne(() => DatetimePreset, {
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    })
    @JoinColumn({ name: 'datetime_preset_id' })
    datetimePreset: DatetimePreset;
}
