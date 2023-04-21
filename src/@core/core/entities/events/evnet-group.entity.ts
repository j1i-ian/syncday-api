import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn
} from 'typeorm';
import { User } from '@entity/users/user.entity';
import { Event } from './event.entity';

@Entity()
export class EventGroup {
    constructor(eventGroup?: Partial<EventGroup>) {
        if (eventGroup) {
            Object.assign(this, eventGroup);
        }
    }

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        length: 100,
        default: 'default',
        nullable: true
    })
    name: string;

    @CreateDateColumn({
        type: 'timestamp'
    })
    createdAt: Date;

    @DeleteDateColumn({
        type: 'timestamp'
    })
    deletedAt: Date;

    @OneToMany(() => Event, (event) => event.eventGroup, {
        cascade: true
    })
    events: Event[];

    @ManyToOne(() => User, (user) => user.eventGroup)
    @JoinColumn()
    user: User;

    @Column()
    userId: number;
}
