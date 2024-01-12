import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Observable, from } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderStatus } from '@interfaces/orders/order-status.enum';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { Order } from '@entity/orders/order.entity';
import { Product } from '@entity/products/product.entity';

@Injectable()
export class OrdersService {

    constructor(
        @InjectRepository(Order)
        private readonly orderRepository: Repository<Order>
    ) {}

    search({
        teamId,
        page = 0,
        take = 50
    }: {
        teamId: number;
        page: number;
        take: number;
    }): Observable<Order[]> {

        const skip = page * take;

        return from(this.orderRepository.find({
            where: { teamId },
            skip,
            take
        }));
    }

    async _create(
        transactionManager: EntityManager,
        product: Product,
        unit: number,
        teamId: number,
        proration = 0,
        orderer?: Orderer
    ): Promise<Order> {
        const orderRepository = transactionManager.getRepository(Order);

        const totalPrice = product.price * unit  - proration;
        const memo = `${product.name}, ${product.price} * ${unit} - ${proration} = ${totalPrice}`;

        const createdOrder = orderRepository.create({
            name: product.name,
            unit,
            amount: totalPrice,
            productId: product.id,
            status: OrderStatus.CHECKOUT,
            memo,
            orderer,
            teamId
        });

        const savedOrder = await orderRepository.save(createdOrder);

        return savedOrder;
    }

    async _updateOrderStatus(
        transactionManager: EntityManager,
        orderId: number,
        orderStatus: OrderStatus
    ): Promise<boolean> {
        const orderRepository = transactionManager.getRepository(Order);

        const updateResult = await orderRepository.update(orderId, {
            status: orderStatus
        });

        return !!(updateResult.affected && updateResult.affected > 0);
    }
}
