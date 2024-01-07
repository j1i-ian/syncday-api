import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Observable, from } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { AppConfigService } from '@config/app-config.service';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { PaymentMethod } from '@entity/payments/payment-method.entity';

@Injectable()
export class PaymentMethodService {
    constructor(
        private readonly configService: ConfigService,
        @InjectDataSource() private readonly datasource: DataSource
    ) {
        const bootpaySetting = AppConfigService.getBootpaySetting(this.configService);

        this.bootpayConfiguration = {
            application_id: bootpaySetting.clientId,
            private_key: bootpaySetting.clientSecret
        };
    }

    bootpayConfiguration: BootpayConfiguration;

    create(
        newPaymentMethod: Pick<PaymentMethod, 'creditCard'> & Partial<Pick<PaymentMethod, 'teams'>>,
        buyer: Buyer,
        orderUUID: string
    ): Observable<PaymentMethod> {
        return from(
            this.datasource.transaction((transactionManager) =>
                this._create(
                    transactionManager,
                    newPaymentMethod,
                    buyer,
                    orderUUID
                )
            )
        );
    }

    async _create(
        transactionManager: EntityManager,
        newPaymentMethod: Pick<PaymentMethod, 'creditCard'> & Partial<Pick<PaymentMethod, 'teams'>>,
        buyer: Buyer,
        orderUUID: string
    ): Promise<PaymentMethod> {
        const _paymentMethodRepository = transactionManager.getRepository(PaymentMethod);

        const createdPaymentMethod = _paymentMethodRepository.create(newPaymentMethod);

        const bootpayService = new BootpayService();

        await bootpayService.patchBootpay();
        bootpayService.setConfig(this.bootpayConfiguration);

        await bootpayService.issueBillingKey(
            orderUUID,
            buyer.name,
            newPaymentMethod.creditCard,
            buyer
        );

        createdPaymentMethod.billing = bootpayService.billing;

        if (newPaymentMethod.teams) {
            createdPaymentMethod.teams = newPaymentMethod.teams;
        }

        const savedPaymentMethod = await _paymentMethodRepository.save(createdPaymentMethod);

        return savedPaymentMethod;
    }
}
