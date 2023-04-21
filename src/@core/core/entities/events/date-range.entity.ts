import { Column } from 'typeorm';

export class DateRange {
    constructor(dateRange?: Partial<DateRange>) {
        if (dateRange) {
            Object.assign(this, dateRange);
        }
    }

    @Column({ type: 'date' })
    before: string;
}
