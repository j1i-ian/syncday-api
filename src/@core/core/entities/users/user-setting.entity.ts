import { AfterLoad, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DateTimeFormatOption } from '@entity/users/date-time-format-option.type';
import { Language } from '@app/enums/language.enum';
import { IntegrationsInfo } from '@app/services/users/interfaces/integrations-info.interface';
import { User } from './user.entity';
import { DateTimeOrderFormat } from './date-time-format-order.enum';

@Entity('user_setting')
export class UserSetting {
    constructor(userSetting?: Partial<UserSetting>) {
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
        unique: true
    })
    workspace: string;

    @Column({
        length: 100,
        nullable: true,
        default: null
    })
    preferredTimezone: string;

    @Column()
    preferredLanguage: Language;

    @Column('simple-json')
    preferredDateTimeFormat: DateTimeFormatOption;

    @Column({
        type: 'simple-array'
    })
    preferredDateTimeOrderFormat: DateTimeOrderFormat[];

    @Column({ nullable: true, default: null })
    greetings: string;

    @OneToOne(() => User, (user) => user.userSetting, {
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'user_id' })
    userId: number;

    integrationInfo: IntegrationsInfo;

    @AfterLoad()
    patchIntegrationInfo(): void {
        if (this.user?.googleIntergrations && this.user?.zoomMeetings) {
            const integratedGoogle = this.user.googleIntergrations.length > 0;
            const integratedZoom = this.user.zoomMeetings.length > 0;

            this.integrationInfo = {
                google: integratedGoogle,
                zoom: integratedZoom
            };
        }
    }
}
