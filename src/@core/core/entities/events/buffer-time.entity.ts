import { Column } from 'typeorm';

export class BufferTime {
    @Column('timestamp', {
        nullable: true
    })
    before?: Date | null;

    @Column('timestamp', {
        nullable: true
    })
    after?: Date | null;
}
