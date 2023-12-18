import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '@entity/payments/payment.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { PaymentMethodService } from './payment-method/payment-method.service';
import { PaymentsService } from './payments.service';
import { BootpayModule } from './bootpay/bootpay.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Payment, PaymentMethod]),
        BootpayModule
    ],
    providers: [PaymentsService, PaymentMethodService],
    exports: [PaymentsService, PaymentMethodService]
})
export class PaymentsModule {}
