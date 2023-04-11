import { Column } from 'typeorm';

export class ScheduleTimeset {
    @Column('timestamp')
    startTimestamp: Date;

    @Column('timestamp')
    endTimestamp: Date;
}
