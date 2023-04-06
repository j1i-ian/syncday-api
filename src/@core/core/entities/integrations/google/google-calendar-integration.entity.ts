import { Column, Entity, Generated, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { GoogleIntegration } from "@entity/integrations/google/google-integration.entity";
import { User } from "@entity/users/user.entity";

/**
 * @property uuid: watch channelId로 사용
 * @property calendarId: created by google
 * @property resourceId: created by google
 */
@Entity()
export class GoogleCalendarIntegration  {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable : true,
        default : null,
        length : 120
    })
    @Generated('uuid')
    uuid: string;

    @Column()
    calendarId: string
    
    @Column({
        nullable: true,
    })
    resourceId: string;
    
    @Column({
        type: "datetime",
        nullable: true,
    })
    channelExpiration: Date;

    @ManyToOne(() => GoogleIntegration, googleIntegration => googleIntegration.googleCalendarIntegrations)
    @JoinColumn()
    googleIntegration: GoogleIntegration;

    @ManyToMany(() => User)
    @JoinTable()
    users: User[];
}
