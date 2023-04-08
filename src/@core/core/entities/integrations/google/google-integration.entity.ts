import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    UpdateDateColumn,
    OneToMany
} from 'typeorm';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { Integration } from '../integration.entity';

@Entity()
export class GoogleIntegration extends Integration {
    @Column()
    email: string;

    @Column()
    accessToken: string;

    @Column()
    refreshToken: string;

    @CreateDateColumn({
        type: 'timestamp'
    })
    createdAt: Date;

    @UpdateDateColumn({
        type: 'timestamp'
    })
    updatedAt: Date;

    @DeleteDateColumn({
        type: 'timestamp'
    })
    deletedAt: Date;

    @OneToMany(
        () => GoogleCalendarIntegration,
        (googleCalendarIntegrations) => googleCalendarIntegrations.googleIntegration
    )
    googleCalendarIntegrations: GoogleCalendarIntegration[];
}
