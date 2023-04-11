import { Column } from 'typeorm';

export class ScheduleBufferTime {
    @Column()
    startBufferTimestamp: Date;

    @Column()
    endBufferTimestamp: Date;
}
