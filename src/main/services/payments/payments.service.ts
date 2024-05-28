import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Observable, combineLatestWith, concatMap, defaultIfEmpty, filter, from, map, mergeMap, of, zip } from 'rxjs';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { PaymentStatus } from '@interfaces/payments/payment-status.enum';
import { PaymentType } from '@interfaces/payments/payment-type.enum';
import { PaymentRedisRepository } from '@services/payments/payment.redis-repository';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { BootpayPGPaymentStatus } from '@services/payments/bootpay-pg-payment-status.enum';
import { PaypalService } from '@services/payments/paypal/paypal.service';
import { Payment } from '@entity/payments/payment.entity';
import { Order } from '@entity/orders/order.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';

@Injectable()
export class PaymentsService {

    constructor(
        private readonly paymentRedisRepository: PaymentRedisRepository,
        private readonly configService: ConfigService,
        private readonly paypalService: PaypalService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

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

        const savedPayment = await _paymentRepository.save(createdPayment);

        if (paymentMethod.type === PaymentType.BILLING_KEY) {
            await this.__placeOrder(
                relatedOrder,
                paymentMethod,
                buyer
            );
        } else {
            await this.paypalService.validatePGSubscription(paymentMethod.vendorSubscriptionUUID);
        }

        return savedPayment;
    }

    async __placeOrder(
        relatedOrder: Order,
        paymentMethod: PaymentMethod,
        buyer: Buyer
    ): Promise<void> {

        const bootpayService = new BootpayService(this.configService);

        const billingPaymentResult = await bootpayService.placeWithBootpay(
            relatedOrder,
            paymentMethod,
            buyer
        );

        await this.paymentRedisRepository.setPGPaymentResult(
            relatedOrder.uuid,
            billingPaymentResult
        );
    }

    _refund(
        relatedOrder: Order,
        canceler: string,
        message: string,
        proratedRefundUnitPrice: number,
        isPartialCancelation: boolean
    ): Observable<boolean> {

        return from(this.paymentRedisRepository.getPGPaymentResult(relatedOrder.uuid))
            .pipe(
                filter((pgPaymentResult) => pgPaymentResult.status !== BootpayPGPaymentStatus.CANCELLED),
                combineLatestWith(of(new BootpayService(this.configService))),
                mergeMap(([pgPaymentResult, bootpayService]) =>
                    bootpayService.refund(
                        relatedOrder.uuid,
                        pgPaymentResult.receipt_id,
                        canceler,
                        message,
                        proratedRefundUnitPrice,
                        isPartialCancelation
                    )
                ),
                concatMap((result) => this.paymentRedisRepository.setPGPaymentResult(
                    relatedOrder.uuid,
                    result
                )),
                defaultIfEmpty(true)
            );
    }

    _save(
        transactionManager: EntityManager,
        relatedOrder: Order,
        proratedRefundUnitPrice: number
    ): Observable<Payment> {
        const paymentRepository$ = of(transactionManager.getRepository(Payment));
        const createdPayment$ = paymentRepository$.pipe(
            map((_paymentRepository) => _paymentRepository.create({
                amount: proratedRefundUnitPrice * -1,
                orderId: relatedOrder.id,
                status: PaymentStatus.PARTIAL_REFUNDED
            }))
        );

        const savePayments$ = zip(paymentRepository$, createdPayment$)
            .pipe(
                mergeMap(([_paymentRepository, createdPayment]) => _paymentRepository.save(createdPayment))
            );

        return savePayments$;
    }
}
