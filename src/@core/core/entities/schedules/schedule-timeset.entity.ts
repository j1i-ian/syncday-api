import { Column } from 'typeorm';

export class ScheduleTimeset {
    @Column()
    startTimestamp: Date;

    @Column()
    endTimestamp: Date;
}
