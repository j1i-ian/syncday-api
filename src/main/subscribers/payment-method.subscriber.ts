import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { PaymentMethod } from '@entities/payments/payment-method.entity';

@EventSubscriber()
export class PaymentMethodSubscriber implements EntitySubscriberInterface<PaymentMethod> {

    listenTo(): new () => PaymentMethod {
        return PaymentMethod;
    }

    beforeUpdate(event: UpdateEvent<PaymentMethod>): void {

        const updatePaymentMethod = event.entity as PaymentMethod;

        this.maskingSensitiveData(updatePaymentMethod);
    }

    beforeInsert(event: InsertEvent<PaymentMethod>): void {

        const newPaymentMethod = event.entity;

        this.maskingSensitiveData(newPaymentMethod);
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
