import { Column, Entity, Generated, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EventDetail } from '../events/event-detail.entity';

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

    @OneToMany(() => EventDetail, (eventDetail) => eventDetail.datetimePreset)
    eventDetails: EventDetail[];
}
