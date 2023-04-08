import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import { Subscription } from '../subscription/subscription.entity';

/**
 * subscribe model
 */
@Entity()
export class SubscriptionPlan {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    price: number;

    @Column()
    name: string;

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

    @OneToMany(() => Subscription, (subscription) => subscription.plan)
    subscriptions: Subscription[];
}
