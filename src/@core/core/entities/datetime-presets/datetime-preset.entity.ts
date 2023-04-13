import { Column, Entity, Generated, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '@entity/users/user.entity';
import { EventDetail } from '../events/event-detail.entity';
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

    @OneToMany(() => EventDetail, (eventDetail) => eventDetail.datetimePreset)
    eventDetails: EventDetail[];

    @ManyToOne(() => User, (user) => user.datetimePresets)
    user: User;

    /**
     * patched from redis
     */
    timepreset: TimePreset[];

    /**
     * patched from redis
     */
    overrides: OverridedTimePreset[];
}
