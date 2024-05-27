import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaypalService } from '@services/payments/paypal/paypal.service';

@Module({
    imports: [
        ConfigModule
    ],
    providers: [PaypalService],
    exports: [PaypalService]
})
export class PaypalModule {}
