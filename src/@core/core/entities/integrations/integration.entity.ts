import { User } from "@entity/users/user.entity";
import { Column, Generated, JoinTable, ManyToMany, PrimaryGeneratedColumn } from "typeorm";

export abstract class Integration {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable : true,
        default : null,
        length : 120
    })
    @Generated('uuid')
    uuid: string;

    @ManyToMany(() => User)
    @JoinTable()
    users: User[];
}
