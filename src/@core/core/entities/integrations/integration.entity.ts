import { Column, Generated, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '@entity/users/user.entity';

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

    @ManyToMany(() => User)
    users: User[];
}
