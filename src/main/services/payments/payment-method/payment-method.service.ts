import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Observable, from, map, mergeMap } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { Billing } from '@core/interfaces/payments/billing.interface';
import { AppConfigService } from '@config/app-config.service';
import { Role } from '@interfaces/profiles/role.enum';
import { PaymentType } from '@interfaces/payments/payment-type.enum';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { ProfilesService } from '@services/profiles/profiles.service';
import { PaypalService } from '@services/payments/paypal/paypal.service';
import { OrdersService } from '@services/orders/orders.service';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { Team } from '@entity/teams/team.entity';
import { Product } from '@entity/products/product.entity';

@Injectable()
export class PaymentMethodService {
    constructor(
        private readonly configService: ConfigService,
        private readonly paypalService: PaypalService,
        private readonly orderService: OrdersService,
        @Inject(forwardRef(() => ProfilesService))
        private readonly profilesService: ProfilesService,
        @InjectDataSource() private readonly datasource: DataSource,
        @InjectRepository(PaymentMethod) private readonly paymentMethodRepository: Repository<PaymentMethod>
    ) {
        const bootpaySetting = AppConfigService.getBootpaySetting(this.configService);

        this.bootpayConfiguration = {
            application_id: bootpaySetting.clientId,
            private_key: bootpaySetting.clientSecret
        };
    }

    bootpayConfiguration: BootpayConfiguration;

    fetch({
        teamId
    }: {
        teamId: number;
    }): Observable<PaymentMethod> {
        return from(this.paymentMethodRepository.findOneOrFail({
            relations: {
                teams: true
            },
            where: {
                teams: {
                    id: teamId
                }
            }
        }));
    }

    create(
        teamId: number,
        newPaymentMethod: Pick<PaymentMethod, 'creditCard' | 'type'> & Partial<Pick<PaymentMethod, 'teams'>>
    ): Observable<PaymentMethod> {

        newPaymentMethod.teams = [{ id: teamId }] as Team[];

        return from(this.profilesService.fetch({
            teamId,
            role: Role.OWNER,
            withUserData: true
        })).pipe(
            map((ownerProfile) => {

                const ownerName: string = (ownerProfile.name
                    || ownerProfile.user.email
                    || ownerProfile.user.phone) as string;

                const buyer: Buyer = {
                    email: ownerProfile.user.email,
                    phone: ownerProfile.user.phone,
                    name: ownerName
                };

                const orderer: Orderer = {
                    name: ownerProfile.name as string,
                    roles: ownerProfile.roles,
                    teamId: ownerProfile.teamId
                };

                return {
                    buyer,
                    orderer,
                    uuid: ownerProfile.uuid
                };
            }),
            mergeMap(({ buyer, uuid: ownerUUID, orderer }) =>
                from(this.datasource.transaction(async (transactionManager) => {

                    const savedPaymentMethod = await this._create(
                        transactionManager,
                        newPaymentMethod,
                        buyer,
                        ownerUUID // set onwer uuid as order uuid
                    );

                    // TODO: should be migrate to other section
                    if (newPaymentMethod.type === PaymentType.PG) {

                        const _productRepository = transactionManager.getRepository(Product);

                        const proPlanProductId = 1;
                        const unit = 1;

                        const loadedProduct = await _productRepository.findOneByOrFail({
                            id: proPlanProductId
                        });

                        const proration = 0;

                        await this.orderService._create(
                            transactionManager,
                            loadedProduct,
                            unit,
                            {
                                teamId
                            },
                            teamId,
                            proration,
                            orderer
                        );
                    }

                    return savedPaymentMethod;
                }))
            )
        );
    }

    async _create(
        transactionManager: EntityManager,
        newPaymentMethod: (Pick<PaymentMethod, 'creditCard' | 'type'>
        & Partial<Pick<PaymentMethod, 'teams'>>),
        buyer: Buyer,
        orderUUID: string
    ): Promise<PaymentMethod> {
        const _paymentMethodRepository = transactionManager.getRepository(PaymentMethod);

        const createdPaymentMethod = _paymentMethodRepository.create(newPaymentMethod);
        createdPaymentMethod.teams = newPaymentMethod.teams as Team[];

        if (newPaymentMethod.type === PaymentType.BILLING_KEY) {
            // TODO: should be located to order service
            createdPaymentMethod.billing = await this._issueBillingKeyWithBootpay(
                newPaymentMethod,
                buyer,
                orderUUID
            );
        } else if (newPaymentMethod.type === PaymentType.PG) {
            await this.paypalService.validatePGSubscription(
                createdPaymentMethod.vendorSubscriptionUUID
            );
        } else {
            throw new BadRequestException('Unsupported payment method type');
        }

        const savedPaymentMethod = await _paymentMethodRepository.save(createdPaymentMethod);

        return savedPaymentMethod;
    }

    async _issueBillingKeyWithBootpay(
        newPaymentMethod: Pick<PaymentMethod, 'creditCard'> & Partial<Pick<PaymentMethod, 'teams'>>,
        buyer: Buyer,
        orderUUID: string
    ): Promise<Billing> {

        let billing: Billing | null = null;

        const bootpayService = new BootpayService(this.configService);

        try {

            await bootpayService._issueBillingKey(
                orderUUID,
                buyer.name,
                newPaymentMethod.creditCard,
                buyer
            );

            billing = bootpayService.billing;

        } catch (error: unknown) {

            const bootpayErrorOrError = bootpayService._toBootpayException(error);

            throw bootpayErrorOrError;
        }

        return billing;
    }

    update(
        id: number,
        teamId: number,
        updatePaymentMethod: Pick<PaymentMethod, 'creditCard'>
    ): Observable<boolean> {
        return from(this.paymentMethodRepository.findOneByOrFail({
            id,
            teams: { id: teamId }
        })).pipe(
            mergeMap((loadedPaymentMethod) =>
                this.paymentMethodRepository.update(
                    loadedPaymentMethod.id,
                    updatePaymentMethod
                )
            ),
            map((updateResult) => !!(updateResult?.affected && updateResult?.affected > 0))
        );
    }
}
