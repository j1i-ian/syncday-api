import { Inject, Injectable, Scope } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { Billing } from '@core/interfaces/payments/billing.interface';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { AppConfigService } from '@config/app-config.service';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { CreditCard } from '@entity/payments/credit-card.entity';
import { Order } from '@entity/orders/order.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { BootpayBackendNodejs, ReceiptResponseParameters } from '@typings/bootpay';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment, import/no-internal-modules
import { CancelPaymentParameters } from '@bootpay/backend-js/lib/response';
import { BootpayException } from '@exceptions/bootpay.exception';
import { InternalBootpayException } from '@exceptions/internal-bootpay.exception';

@Injectable({
    scope: Scope.REQUEST
})
export class BootpayService {

    constructor(
        private readonly configService: ConfigService
    ) {}

    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

    private _billing: Billing;
    private Bootpay: BootpayBackendNodejs;

    async placeWithBootpay(
        relatedOrder: Order,
        paymentMethod: PaymentMethod,
        buyer: Buyer
    ): Promise<ReceiptResponseParameters> {

        try {

            await this._init(this.configService);

            const pgPaymentResult = await this._placeOrder(
                relatedOrder,
                relatedOrder.amount,
                buyer,
                paymentMethod.billing
            );

            return pgPaymentResult;
        } catch (error) {

            const bootpayError = (error as InternalBootpayException);

            if (bootpayError.error_code && bootpayError.message) {

                const bootpayException = new BootpayException(bootpayError.message);
                bootpayException.name = bootpayError.error_code;
                bootpayException.message = bootpayError.message;

                this.logger.error({
                    message: 'Error while placing the order',
                    error,
                    bootpayException
                });

                error = bootpayException;
            }

            throw error;
        }
    }

    async _init(
        configService: ConfigService
    ): Promise<void> {

        const bootpaySetting = AppConfigService.getBootpaySetting(configService);

        const bootpayConfiguration = {
            application_id: bootpaySetting.clientId,
            private_key: bootpaySetting.clientSecret
        } as BootpayConfiguration;

        await this.__patchBootpay();

        this.__setConfig(bootpayConfiguration);

        await this.Bootpay.getAccessToken();
    }

    async __patchBootpay(): Promise<void> {
        const { Bootpay } = (await import('@bootpay/backend-js'));

        this.Bootpay = Bootpay;
    }

    __setConfig(bootpayConfig: BootpayConfiguration): this {
        this.Bootpay.setConfiguration(bootpayConfig);

        return this;
    }

    async _placeOrder(
        order: Order,
        price: number,
        buyer: Partial<Buyer>,
        billing?: Billing
    ): Promise<ReceiptResponseParameters> {

        this._billing = billing ?? this._billing;

        const KoreanPhoneNumberFormatOrUndefined = buyer.phone?.includes('+82') ?
            buyer.phone?.replace('+82', '10') :
            undefined;

        const paymentResponse = await this.Bootpay.requestSubscribeCardPayment({
            order_id: String(order.id),
            order_name: order.name,
            billing_key: this._billing.key,
            price,
            tax_free: 0,
            user: {
                username: buyer.name,
                email: buyer.email as string,
                phone: KoreanPhoneNumberFormatOrUndefined
            }
        });

        return paymentResponse;
    }

    async _issueBillingKey(
        orderId: string,
        placedOrderName: string,
        creditCard: CreditCard,
        buyer: Buyer
    ): Promise<BootpayService> {

        await this._init(this.configService);

        await this._getAccessToken();

        const pg = '나이스페이';

        const KoreanPhoneNumberFormatOrUndefined = buyer.phone?.includes('+82') ?
            buyer.phone?.replace('+82', '10') :
            undefined;

        const {
            billing_key,
            billing_expire_at
        } = await this.Bootpay.requestSubscribeBillingKey({
            pg,
            subscription_id: orderId,
            order_name: placedOrderName,
            card_no: creditCard.serialNumber,
            card_pw: creditCard.password,
            card_identity_no: creditCard.identification,
            card_expire_year: creditCard.expirationYear,
            card_expire_month: creditCard.expirationMonth,
            user: {
                username: buyer.name,
                email: buyer.email as string,
                phone: KoreanPhoneNumberFormatOrUndefined
            },
            extra: {
                subscribe_test_payment: true
            }
        });

        this._billing = {
            key: billing_key,
            expireAt: billing_expire_at
        };

        return this;
    }

    async refund(
        orderUUID: string,
        receiptId: string,
        canceler: string,
        message: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        refundPrice: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        partialCancelation: boolean
    ): Promise<ReceiptResponseParameters> {

        await this._init(this.configService);

        await this._getAccessToken();

        const cancelPaymentOptions: CancelPaymentParameters = {
            receipt_id: receiptId,
            cancel_tax_free: 0,
            cancel_id: orderUUID,
            cancel_username: canceler,
            cancel_message: message
        };

        // TODO: Patial Cancellation Issue is migrated to #703
        // if (!partialCancelation) {
        //     cancelPaymentOptions.cancel_price = refundPrice;
        // }

        const response = await this.Bootpay.cancelPayment(cancelPaymentOptions);

        return response;
    }

    async _getAccessToken(): Promise<void> {
        await this.Bootpay.getAccessToken();
    }

    _toBootpayException(
        error: unknown
    ): BootpayException | unknown {

        const bootpayError = (error as InternalBootpayException);

        if (bootpayError.error_code && bootpayError.message) {

            const bootpayException = new BootpayException(bootpayError.message);
            bootpayException.name = bootpayError.error_code;
            bootpayException.message = bootpayError.message;

            this.logger.error({
                message: 'Error while issue the billing key',
                error,
                bootpayException
            });

            error = bootpayException;
        }

        throw error;
    }

    get billing(): Billing {
        return this._billing;
    }
}
