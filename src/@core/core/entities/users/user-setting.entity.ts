import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";

@Entity('user_setting')
export class UserSetting {

    @PrimaryGeneratedColumn()
    id: number;

    /**
     * link for invitee scheduling path
     */
    @Column()
    link: string;

    @Column({
        length: 100
    })
    preferredTimezone: string;

    @Column()
    preferredLanguage: string;

    @OneToOne(() => User, user => user.userSetting, {
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    })
    @JoinColumn()
    user: User;
}
