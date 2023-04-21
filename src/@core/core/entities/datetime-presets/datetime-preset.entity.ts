import {
    AfterLoad,
    Column,
    Entity,
    Generated,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn
} from 'typeorm';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { TimePreset } from './time-preset.entity';
import { OverridedTimePreset } from './overrided-time-preset.entity';

/**
 * @property default: 디폴트 time preset 유무
 */
@Entity()
export class DatetimePreset {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable: true,
        default: null,
        length: 120
    })
    @Generated('uuid')
    uuid: string;

    @Column()
    name: string;

    @Column({
        default: false
    })
    default: boolean;

    @Column({
        nullable: true,
        default: null
    })
    timezone: string;

    @OneToMany(() => Event, (evnet) => evnet.datetimePreset)
    events: Event[];

    @ManyToOne(() => User, (user) => user.datetimePresets)
    user: User;

    @Column()
    userId: number;

    /**
     * patched from redis
     */
    timepreset: TimePreset[];

    /**
     * patched from redis
     */
    overrides: OverridedTimePreset[];

    relatedEventCount?: number;

    @AfterLoad()
    countRelatedEvent(): void {
        if (this.events) {
            this.relatedEventCount = this.events.length;
        }
    }
}
