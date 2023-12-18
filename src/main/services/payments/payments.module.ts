import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentRedisRepository } from '@services/payments/payment.redis-repository';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { Payment } from '@entity/payments/payment.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { PaymentMethodService } from './payment-method/payment-method.service';
import { PaymentsService } from './payments.service';
import { BootpayModule } from './bootpay/bootpay.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Payment, PaymentMethod]),
        ConfigModule,
        BootpayModule,
        SyncdayRedisModule
    ],
    providers: [PaymentsService, PaymentMethodService, PaymentRedisRepository],
    exports: [PaymentsService, PaymentMethodService]
})
export class PaymentsModule {}
