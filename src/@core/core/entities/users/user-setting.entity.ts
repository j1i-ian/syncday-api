import { AfterLoad, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Language } from '@app/enums/language.enum';
import { IntegrationsInfo } from '../../../../main/services/users/interfaces/integrations-info.interface';
import { User } from './user.entity';

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

    @Column('simple-json', { nullable: true, default: null })
    preferredDateTimeFormat: Intl.DateTimeFormatOptions;

    @Column({
        type: 'simple-array',
        nullable: true,
        default: null
    })
    preferredDateTimeOrderFormat: Array<'year' | 'month' | 'day'>;

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
        if (this.user) {
            const integratedGoogle = this.user.googleIntergrations.length > 0;
            this.integrationInfo = {
                google: integratedGoogle
            };
        }
    }
}
