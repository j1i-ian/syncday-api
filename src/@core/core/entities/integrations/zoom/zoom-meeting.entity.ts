import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    ManyToMany,
    UpdateDateColumn
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Integration } from '../integration.entity';

@Entity()
export class ZoomMeeting extends Integration {
    @Column({
        length: 650
    })
    accessToken: string;

    @Column({
        length: 650
    })
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

    @ManyToMany(() => User, (user) => user.zoomMeetings)
    users: User[];
}
