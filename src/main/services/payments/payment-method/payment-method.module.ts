import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentMethodController } from '@services/payments/payment-method/payment-method.controller';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { ProfilesModule } from '@services/profiles/profiles.module';
import { PaymentMethod } from '@entity/payments/payment-method.entity';

@Module({
    controllers: [PaymentMethodController],
    imports: [
        TypeOrmModule.forFeature([PaymentMethod]),
        ConfigModule,
        ProfilesModule
    ],
    providers: [PaymentMethodService],
    exports: [PaymentMethodService]
})
export class PaymentMethodModule {}
