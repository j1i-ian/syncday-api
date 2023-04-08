import { Column } from 'typeorm';

/**
 * @property {number} before second for unix epoch time
 * @property {number} after second for unix epoch time
 */
export class BufferTime {
    @Column('time', {
        default: '00:00:00'
    })
    before: string | number;

    @Column('time', {
        default: '00:00:00'
    })
    after: string | number;
}
