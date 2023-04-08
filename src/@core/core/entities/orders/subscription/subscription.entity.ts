import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import { User } from '@entity/users/user.entity';
import { SubscriptionPlan } from '../subscription-plans/subscription-plan.entity';
import { SubscriptionStatus } from './subscription-status.enum';

@Entity()
export class Subscription {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    price: number;

    @Column('enum', {
        enum: SubscriptionStatus
    })
    status: SubscriptionStatus;

    @CreateDateColumn({
        type: 'timestamp'
    })
    createdAt: Date;

    @UpdateDateColumn({
        type: 'timestamp'
    })
    updatedAt: Date;

    @OneToOne(() => User)
    user: User;

    @ManyToOne(() => SubscriptionPlan, (subscriptionPlan) => subscriptionPlan.subscriptions, {
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    })
    @JoinColumn()
    plan: SubscriptionPlan;
}
