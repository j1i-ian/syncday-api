import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { AppConfigService } from '@config/app-config.service';
import { PaymentStatus } from '@interfaces/payments/payment-status.enum';
import { PaymentRedisRepository } from '@services/payments/payment.redis-repository';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { BootpayPGPaymentStatus } from '@services/payments/bootpay-pg-payment-status.enum';
import { Payment } from '@entity/payments/payment.entity';
import { Order } from '@entity/orders/order.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';

@Injectable()
export class PaymentsService {

    constructor(
        private readonly paymentRedisRepository: PaymentRedisRepository,
        private readonly configService: ConfigService
    ) {
        const bootpaySetting = AppConfigService.getBootpaySetting(this.configService);

        this.bootpayConfiguration = {
            application_id: bootpaySetting.clientId,
            private_key: bootpaySetting.clientSecret
        };
    }

    bootpayConfiguration: BootpayConfiguration;

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
        proration: number,
        relatedOrder: Order,
        paymentMethod: PaymentMethod,
        buyer: Buyer
    ): Promise<Payment> {
        const _paymentRepository = transactionManager.getRepository(Payment);

        const createdPayment = _paymentRepository.create({
            amount: relatedOrder.amount,
            orderId: relatedOrder.id,
            proration,
            paymentMethodId: paymentMethod.id
        });

        const bootpayService = new BootpayService();

        await bootpayService.init(this.bootpayConfiguration);

        const pgPaymentResult = await bootpayService.placeOrder(
            relatedOrder,
            relatedOrder.amount,
            buyer,
            paymentMethod.billing
        );

        await this.paymentRedisRepository.setPGPaymentResult(
            relatedOrder.uuid,
            pgPaymentResult
        );

        const savedPayment = await _paymentRepository.save(createdPayment);

        return savedPayment;
    }

    async _refund(
        transactionManager: EntityManager,
        relatedOrder: Order,
        canceler: string,
        message: string,
        proratedRefundUnitPrice: number,
        isPartialCancelation: boolean
    ): Promise<Payment> {

        const _paymentRepository = transactionManager.getRepository(Payment);

        const createdPayment = _paymentRepository.create({
            amount: proratedRefundUnitPrice * -1,
            orderId: relatedOrder.id,
            status: PaymentStatus.PARTIAL_REFUNDED
        });

        const savedPayment = await _paymentRepository.save(createdPayment);

        const pgPaymentResult = await this.paymentRedisRepository.getPGPaymentResult(relatedOrder.uuid);

        if (pgPaymentResult.status !== BootpayPGPaymentStatus.CANCELLED) {

            const bootpayService = new BootpayService();

            await bootpayService.init(this.bootpayConfiguration);

            const result = await bootpayService.refund(
                relatedOrder.uuid,
                pgPaymentResult.receipt_id,
                canceler,
                message,
                proratedRefundUnitPrice,
                isPartialCancelation
            );

            await this.paymentRedisRepository.setPGPaymentResult(
                relatedOrder.uuid,
                result
            );
        }

        return savedPayment;
    }
}
