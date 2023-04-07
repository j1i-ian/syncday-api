import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.entity";
import { Language } from "@app/enums/language.enum";

@Entity('user_setting')
export class UserSetting {

    constructor(userSetting?: UserSetting) {
        if (userSetting) {
            Object.assign(this, userSetting);
        }
    }

    @PrimaryGeneratedColumn()
    id: number;

    /**
     * link for invitee scheduling path
     */
    @Column({
        unique: true,
    })
    link: string;

    @Column({
        length: 100,
        nullable: true,
        default: null
    })
    preferredTimezone: string;

    @Column()
    preferredLanguage: Language;

    @Column('simple-json', { nullable: true, default: null })
    preferredDateTimeFormat: Intl.DateTimeFormatOptions;

    @Column({ nullable: true, default: null })
    preferredDateTimeOrderFormat: string;
    
    @Column({ nullable: true, default: null })
    greetings: string;

    @OneToOne(() => User, user => user.userSetting, {
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    })
    @JoinColumn({ name:'user_id' })
    user: User;

    @Column({ name: 'user_id' })
    userId: number;
}
