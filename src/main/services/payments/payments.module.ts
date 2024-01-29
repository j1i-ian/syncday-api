import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentRedisRepository } from '@services/payments/payment.redis-repository';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { Payment } from '@entity/payments/payment.entity';
import { PaymentsService } from './payments.service';
import { BootpayModule } from './bootpay/bootpay.module';
import { PaymentMethodModule } from './payment-method/payment-method.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Payment]),
        ConfigModule,
        BootpayModule,
        SyncdayRedisModule,
        PaymentMethodModule
    ],
    providers: [PaymentsService, PaymentRedisRepository],
    exports: [PaymentsService]
})
export class PaymentsModule {}
