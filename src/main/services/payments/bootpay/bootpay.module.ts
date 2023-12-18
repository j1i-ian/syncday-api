import { Module } from '@nestjs/common';
import { BootpayService } from './bootpay.service';

@Module({
    providers: [BootpayService],
    exports: [BootpayService]
})
export class BootpayModule {}
