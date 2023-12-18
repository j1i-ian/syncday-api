import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Observable, from } from 'rxjs';
import { PaymentMethod } from '@entity/payments/payment-method.entity';

@Injectable()
export class PaymentMethodService {
    constructor(
        @InjectDataSource() private readonly datasource: DataSource
    ) {}

    create(newPaymentMethod: PaymentMethod): Observable<PaymentMethod> {
        return from(
            this.datasource.transaction((transactionManager) =>
                this._create(transactionManager, newPaymentMethod)
            )
        );
    }

    async _create(
        transactionManager: EntityManager,
        newPaymentMethod: Partial<PaymentMethod>
    ): Promise<PaymentMethod> {
        const _paymentMethodRepository = transactionManager.getRepository(PaymentMethod);

        const createdPaymentMethod = _paymentMethodRepository.create(newPaymentMethod);

        const savedPaymentMethod = await _paymentMethodRepository.save(createdPaymentMethod);

        return savedPaymentMethod;
    }
}
