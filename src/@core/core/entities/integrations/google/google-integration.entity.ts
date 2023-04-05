import { Column, CreateDateColumn, DeleteDateColumn, Entity, Generated, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Integration } from "../integration.entity";

@Entity()
export class GoogleIntegration extends Integration {

    @Column()
    email: string

    @Column()
    accessToken: string

    @Column()
    refreshToken: string
    
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
}
