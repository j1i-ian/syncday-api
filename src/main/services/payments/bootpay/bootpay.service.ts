import { Injectable, Scope } from '@nestjs/common';
import { Billing } from '@core/interfaces/payments/billing.interface';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { CreditCard } from '@entity/payments/credit-card.entity';
import { Order } from '@entity/orders/order.entity';
import { Bootpay } from '@bootpay/backend-js';
// eslint-disable-next-line import/no-internal-modules
import { ReceiptResponseParameters } from '@bootpay/backend-js/lib/response';

@Injectable({
    scope: Scope.REQUEST
})
export class BootpayService {

    private _billing: Billing;

    setConfig(bootpayConfig: BootpayConfiguration): BootpayService {
        Bootpay.setConfiguration(bootpayConfig);

        return this;
    }

    async placeOrder(
        order: Order,
        price: number,
        buyer: Partial<Buyer>,
        billing?: Billing
    ): Promise<ReceiptResponseParameters> {

        this._billing = billing ?? this._billing;

        const paymentResponse = await Bootpay.requestSubscribeCardPayment({
            order_id: String(order.id),
            order_name: order.name,
            billing_key: this._billing.key,
            price,
            tax_free: 0,
            user: {
                username: buyer.name,
                email: buyer.email,
                phone: buyer.phone
            }
        });

        return paymentResponse;
    }

    async issueBillingKey(
        orderId: string,
        teamName: string,
        creditCard: CreditCard,
        buyer: {
            name: string;
            email?: string;
            phone?: string;
        }
    ): Promise<BootpayService> {

        await this._getAccessToken();

        const pg = '나이스페이';

        const {
            billing_key,
            billing_expire_at
        } = await Bootpay.requestSubscribeBillingKey({
            pg,
            subscription_id: orderId,
            order_name: teamName,
            card_no: creditCard.serialNumber,
            card_pw: creditCard.password,
            card_identity_no: creditCard.identification,
            card_expire_year: creditCard.expirationYear,
            card_expire_month: creditCard.expirationMonth,
            user: {
                username: buyer.name,
                email: buyer.email,
                phone: buyer.phone
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
        await Bootpay.getAccessToken();
    }
}
