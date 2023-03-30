import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Schedule } from "../schedules/schedule.entity";
import { BufferTime } from "./buffer-time.entity";
import { EventType } from "./event-type.entity";
import { EventGroup } from "./evnet-group.entity";

@Entity()
export class Event {

    @PrimaryGeneratedColumn()
    id: number;

    @Column('enum', {
        enum: EventType
    })
    eventType: EventType;

    @Column(() => BufferTime)
    bufferTime: BufferTime;

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

    @OneToMany(() => Schedule, schedule => schedule.event)
    schedule: Schedule[];

    @ManyToOne(() => EventGroup, eventGroup => eventGroup.events)
    @JoinColumn()
    eventGroup: EventGroup;
}
