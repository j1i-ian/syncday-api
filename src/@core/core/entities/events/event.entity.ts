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
import { ContactType } from '@app/services/event-groups/events/enums/contact-type.enum';
import { EventType } from './event-type.entity';
import { EventGroup } from './evnet-group.entity';
import { EventStatus } from './event-status.enum';
import { EventDetail } from './event-detail.entity';

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
        nullable: true,
        default: null,
        length: 120
    })
    @Generated('uuid')
    uuid: string;

    @Column({
        length: 200
    })
    name: string;

    @Column({
        default: '#000000',
        length: 10
    })
    color: string;

    @Column('enum', {
        enum: EventStatus
    })
    status: EventStatus;

    @Column('enum', {
        enum: EventType
    })
    type: EventType;

    @Column({
        default: 1
    })
    maxParticipants: number;

    @Column('time', {
        default: '00:00:00'
    })
    duration: string | number;

    @Column({ type: 'enum', enum: ContactType })
    contactType: ContactType;

    @Column({ nullable: true, default: null })
    contact: string;

    @Column()
    link: string;

    @Column({
        default: true
    })
    public: boolean;

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

    @OneToOne(() => EventDetail, { cascade: true })
    eventDetail: EventDetail;

    @ManyToOne(() => EventGroup, (eventGroup) => eventGroup.events)
    @JoinColumn()
    eventGroup: EventGroup;
}
