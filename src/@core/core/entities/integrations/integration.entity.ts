import { Column, Generated, PrimaryGeneratedColumn } from 'typeorm';

export abstract class Integration {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable: true,
        default: null,
        length: 120
    })
    @Generated('uuid')
    uuid: string;
}
