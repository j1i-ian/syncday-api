import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { PaymentType } from '@interfaces/payments/payment-type.enum';
import { Billing } from '@interfaces/payments/billing.interface';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { CreditCard } from '@entity/payments/credit-card.entity';

@EventSubscriber()
export class PaymentMethodSubscriber implements EntitySubscriberInterface<PaymentMethod> {

    listenTo(): new () => PaymentMethod {
        return PaymentMethod;
    }

    beforeUpdate(event: UpdateEvent<PaymentMethod>): void {

        const updatePaymentMethod = event.entity as PaymentMethod;

        if (updatePaymentMethod.type !== PaymentType.PG) {
            this.maskingSensitiveData(updatePaymentMethod);
        }
    }

    beforeInsert(event: InsertEvent<PaymentMethod>): void {

        const newPaymentMethod = event.entity;

        if (newPaymentMethod.type !== PaymentType.PG) {
            this.maskingSensitiveData(newPaymentMethod);
        } else {
            newPaymentMethod.billing = {
                expireAt: null,
                key: null
            } as unknown as Billing;
            newPaymentMethod.creditCard = {
                expirationYear: null,
                expirationMonth: null,
                identification: null,
                password: null,
                serialNumber: null,
                cvc: null
            } as unknown as CreditCard;
        }
    }

    maskingSensitiveData(newPaymentMethod: PaymentMethod): void {

        const creditCard = newPaymentMethod.creditCard;
        const {
            serialNumber,
            identification,
            expirationMonth,
            expirationYear,
            cvc
        } = creditCard;

        const maskedCardNumber = serialNumber
            .slice(-4)
            .padStart(creditCard.serialNumber.length, '*');
        const maskedIdentification = identification
            .slice(0, 6)
            .padEnd(creditCard.identification.length, '*');
        const maskedPassword = ''
            .slice(4)
            .padStart(creditCard.password.length, '*');

        newPaymentMethod.creditCard = {
            serialNumber: maskedCardNumber,
            identification: maskedIdentification,
            password: maskedPassword,
            expirationMonth,
            expirationYear,
            cvc
        };
    }
}
