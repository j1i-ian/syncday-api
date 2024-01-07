import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OrderStatus } from '@interfaces/orders/order-status.enum';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { Order } from '@entity/orders/order.entity';
import { Product } from '@entity/products/product.entity';

@Injectable()
export class OrdersService {

    constructor() {}

    async _create(
        transactionManager: EntityManager,
        product: Product,
        unit: number,
        teamId: number,
        orderer?: Orderer
    ): Promise<Order> {
        const orderRepository = transactionManager.getRepository(Order);

        const totalPrice = unit * product.price;
        const memo = `${product.name}, ${product.price} * ${unit} = ${totalPrice}`;

        const createdOrder = orderRepository.create({
            name: product.name,
            unit,
            price: totalPrice,
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
