import { User } from "@entity/users/user.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { SubscriptionPlan } from "../subscription-plans/subscription-plan.entity";
import { SubscriptionStatus } from "./subscription-status.enum";

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

    @ManyToOne(() => SubscriptionPlan, subscriptionPlan => subscriptionPlan.subscriptions, {
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    })
    @JoinColumn()
    plan: SubscriptionPlan;
}
