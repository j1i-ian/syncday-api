import {
    Column,
    Entity,
    Generated,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn
} from 'typeorm';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { User } from '@entity/users/user.entity';
import { IntegrationCalendarSetting } from './Integration-calendar-setting.entity';

/**
 * @property uuid: watch channelId로 사용
 * @property calendarId: created by google
 * @property resourceId: created by google
 * @property subject: 켈린더 명
 */
@Entity()
export class GoogleCalendarIntegration {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable: true,
        default: null,
        length: 120
    })
    @Generated('uuid')
    uuid: string;

    @Column()
    calendarId: string;

    @Column({
        nullable: true,
        type: 'varchar'
    })
    resourceId: string | null;

    @Column({
        type: 'datetime',
        nullable: true
    })
    channelExpiration: Date | null;

    @Column(() => IntegrationCalendarSetting)
    settings: IntegrationCalendarSetting;

    @Column()
    subject: string;

    @ManyToOne(
        () => GoogleIntegration,
        (googleIntegration) => googleIntegration.googleCalendarIntegrations
    )
    @JoinColumn()
    googleIntegration: GoogleIntegration;

    @ManyToMany(() => User)
    @JoinTable()
    users: User[];
}
