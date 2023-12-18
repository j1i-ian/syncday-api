import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Payment } from '@entity/payments/payment.entity';
import { Order } from '@entity/orders/order.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';

@Injectable()
export class PaymentsService {

    constructor() {}

    /**
     * Payment is always based on the act intended for the purchase of goods.
     *
     * So creating payment is always transactional.
     *
     * @param transactionManager
     * @param newPayment
     */
    async _create(
        transactionManager: EntityManager,
        relatedOrder: Order,
        paymentMethod: PaymentMethod
    ): Promise<Payment> {
        const _paymentRepository = transactionManager.getRepository(Payment);

        const createdPayment = _paymentRepository.create({
            amount: relatedOrder.price,
            orderId: relatedOrder.id,
            paymentMethodId: paymentMethod.id
        });

        const savedPayment = await _paymentRepository.save(createdPayment);

        return savedPayment;
    }
}
