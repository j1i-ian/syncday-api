import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '@entities/orders/order.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Order])
    ],
    providers: [OrdersService],
    exports: [OrdersService],
    controllers: [OrdersController]
})
export class OrdersModule {}
