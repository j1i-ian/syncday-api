import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BootpayService } from './bootpay.service';

@Module({
    imports: [
        ConfigModule
    ],
    providers: [BootpayService],
    exports: [BootpayService]
})
export class BootpayModule {}
