import { Column } from 'typeorm';

export class TimeRange {
    @Column('time', {
        default: '00:00:00'
    })
    startTime: string | number;

    @Column('time', {
        default: '00:00:00'
    })
    endTime: string | number;
}
