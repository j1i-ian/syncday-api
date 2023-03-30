import { Column } from "typeorm";

export class BufferTime {

    @Column({
        nullable: true
    })
    before?: Date | null;

    @Column({
        nullable: true
    })
    after?: Date | null;
}
