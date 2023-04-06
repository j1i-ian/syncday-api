import { EventGroup } from "@entity/events/evnet-group.entity";
import { PaymentTransaction } from "@entity/payments/payment-transaction.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, Generated, JoinTable, ManyToMany, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { GoogleIntegration } from "../integrations/google/google-integration.entity";
import { Role } from "./role.enum";
import { UserSetting } from "./user-setting.entity";

@Entity('user')
export class User {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        nullable : true,
        default : null,
        length : 120
    })
    @Generated('uuid')
    uuid: string;

    @Column({
        unique: true,
        length: 100
    })
    email: string;

    @Column({
        nullable: true
    })
    hashedPassword: string;

    @Column({
        nullable: true,
        default: null,
        length: 50
    })
    nickname: string;

    @Column({
        nullable: true,
        default: null,
        length: 15
    })
    phone: string;

    @Column('varchar', {
        length: 300,
        default: null,
        nullable: true
    })
    profileImage: string | null;

    @Column('varchar', {
        length: 300,
        default: null,
        nullable: true
    })
    workspace: string | null;

    @Column('simple-array', {
        select: false,
        default: JSON.stringify([Role.UNVERIFIED])
    })
    roles: Role[];

    @CreateDateColumn({
        type: 'timestamp'
    })
    createdAt: Date;

    @UpdateDateColumn({
        type: 'timestamp'
    })
    updatedAt: Date;

    @DeleteDateColumn({
        type: "timestamp",
    })
    deletedAt: Date;

    @OneToOne(() => UserSetting, (userSetting) => userSetting.user, {
        cascade: true
    })
    userSetting: UserSetting;

    @ManyToMany(() => GoogleIntegration, (googleIntegration) => googleIntegration.users, {
        cascade: true
    })
    @JoinTable({
        name: "google_integration_users",
        joinColumn: {
            name: "user_id",
            referencedColumnName: "id"
        },
        inverseJoinColumn: {
            name: "google_integration_id",
            referencedColumnName: "id"
        },
    })
    googleIntergrations: GoogleIntegration[];

    @OneToMany(() => EventGroup, eventGroup => eventGroup.user)
    eventGroup: EventGroup[];

    @OneToMany(() => PaymentTransaction, payment => payment.user)
    paymentTransactions: PaymentTransaction[];
}
