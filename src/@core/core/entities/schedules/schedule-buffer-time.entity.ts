import { Column } from 'typeorm';

export class ScheduleBufferTime {
    @Column('timestamp')
    startBufferTimestamp: Date;

    @Column('timestamp')
    endBufferTimestamp: Date;
}
