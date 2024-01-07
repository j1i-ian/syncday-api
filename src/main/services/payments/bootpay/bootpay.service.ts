import { Injectable, Scope } from '@nestjs/common';
import { Billing } from '@core/interfaces/payments/billing.interface';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { CreditCard } from '@entity/payments/credit-card.entity';
import { Order } from '@entity/orders/order.entity';
import { BootpayBackendNodejs, ReceiptResponseParameters } from '@typings/bootpay';

@Injectable({
    scope: Scope.REQUEST
})
export class BootpayService {

    private _billing: Billing;
    private Bootpay: BootpayBackendNodejs;

    async init(bootpayConfig: BootpayConfiguration): Promise<void> {
        await this.patchBootpay();

        this.setConfig(bootpayConfig);

        await this.Bootpay.getAccessToken();
    }

    async patchBootpay(): Promise<void> {
        const { Bootpay } = (await import('@bootpay/backend-js'));

        this.Bootpay = Bootpay;
    }

    setConfig(bootpayConfig: BootpayConfiguration): this {
        this.Bootpay.setConfiguration(bootpayConfig);

        return this;
    }

    async placeOrder(
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
                email: buyer.email,
                phone: KoreanPhoneNumberFormatOrUndefined
            }
        });

        return paymentResponse;
    }

    async issueBillingKey(
        orderId: string,
        placedOrderName: string,
        creditCard: CreditCard,
        buyer: {
            name: string;
            email?: string;
            phone?: string;
        }
    ): Promise<BootpayService> {

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
                email: buyer.email,
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

    async _getAccessToken(): Promise<void> {
        await this.Bootpay.getAccessToken();
    }

    get billing(): Billing {
        return this._billing;
    }
}
