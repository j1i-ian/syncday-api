import { Column } from 'typeorm';

export class DateRange {
    constructor(dateRange?: Partial<DateRange>) {
        if (dateRange) {
            Object.assign(this, dateRange);
        }
    }

    /**
     * This criteria restricts as condition when schedule should be created how many days before
     */
    @Column()
    before: number;
}
