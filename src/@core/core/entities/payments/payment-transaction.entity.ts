import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Generated,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';
import { Subscription } from '@entity/orders/subscription/subscription.entity';
import { User } from '@entity/users/user.entity';
import { Currency } from './currency.enum';
import { PaymentGateType } from './payment-gate-type.enum';
import { PaymentStatus } from './payment-status.enum';

/**
 * @property amount actualy paid dollar
 */
@Entity()
export class PaymentTransaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable: true,
        default: null,
        length: 120
    })
    @Generated('uuid')
    uuid: string;

    @Column({
        default: 0
    })
    amount: number;

    @Column({
        nullable: true,
        default: null
    })
    invoiceUrl: number;

    @Column('enum', {
        enum: Currency
    })
    currency: Currency;

    @Column('enum', {
        enum: PaymentStatus
    })
    status: PaymentStatus;

    @Column('enum', {
        enum: PaymentGateType,
        nullable: true
    })
    paymentGateType: PaymentGateType;

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

    @Column('simple-json')
    subscription: Subscription;

    @ManyToOne(() => User, (user) => user.paymentTransactions, {
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
    })
    @JoinColumn()
    user: User;
}
