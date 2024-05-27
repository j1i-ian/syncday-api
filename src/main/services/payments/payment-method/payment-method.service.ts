/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Observable, from, map, mergeMap } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import fetch from 'node-fetch';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { Billing } from '@core/interfaces/payments/billing.interface';
import { AppConfigService } from '@config/app-config.service';
import { Role } from '@interfaces/profiles/role.enum';
import { PaymentType } from '@interfaces/payments/payment-type.enum';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { ProfilesService } from '@services/profiles/profiles.service';
import { OrdersService } from '@services/orders/orders.service';
import { ProductsService } from '@services/products/products.service';
import { PayPalTokenResponse, SubscriptionCheckRequestBody } from '@services/payments/payment-method/paypal.interfaces';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { Team } from '@entity/teams/team.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { BootpayException } from '@exceptions/bootpay.exception';
import { InternalBootpayException } from '@exceptions/internal-bootpay.exception';

@Injectable()
export class PaymentMethodService {
    constructor(
        private readonly configService: ConfigService,
        private readonly orderService: OrdersService,
        private readonly productService: ProductsService,
        @Inject(forwardRef(() => ProfilesService))
        private readonly profilesService: ProfilesService,
        @InjectDataSource() private readonly datasource: DataSource,
        @InjectRepository(PaymentMethod) private readonly paymentMethodRepository: Repository<PaymentMethod>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
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

                return {
                    buyer,
                    uuid: ownerProfile.uuid,
                    ownerProfile
                };
            }),
            mergeMap(({ buyer, uuid: ownerUUID, ownerProfile }) =>
                from(this.datasource.transaction((transactionManager) =>
                    this._create(
                        transactionManager,
                        newPaymentMethod,
                        buyer,
                        ownerUUID,
                        teamId,
                        ownerProfile
                    )
                ))
            )
        );
    }

    async _create(
        transactionManager: EntityManager,
        newPaymentMethod: (Pick<PaymentMethod, 'creditCard' | 'type'>
        & Partial<Pick<PaymentMethod, 'teams'>>),
        buyer: Buyer,
        orderUUID: string,
        teamId?: number,
        profile?: Profile
    ): Promise<PaymentMethod> {
        const _paymentMethodRepository = transactionManager.getRepository(PaymentMethod);

        const createdPaymentMethod = _paymentMethodRepository.create(newPaymentMethod);

        if (newPaymentMethod.type === PaymentType.BILLING_KEY) {
            createdPaymentMethod.billing = await this._issueBillingKeyWithBootpay(
                newPaymentMethod,
                buyer,
                orderUUID
            );
        } else if (newPaymentMethod.type === PaymentType.PG) {

            // check paypal subscription
            // await this.getToken(newPaymentMethod as unknown as PaymentMethod);
            const token = await this.getToken();

            await this.checkSubscription(token, createdPaymentMethod);

            const proplanProduct = await this.productService.findTeamPlanProduct(1);
            // add an order
            await this.orderService._create(
                transactionManager,
                proplanProduct,
                1,
                {
                    teamId
                },
                teamId as number,
                0,
                profile ? {
                    name: profile?.name as string ,
                    roles: profile?.roles,
                    teamId: profile?.teamId
                } as Orderer :
                    undefined
            );
        }

        if (newPaymentMethod.teams) {
            createdPaymentMethod.teams = newPaymentMethod.teams;
        }

        const savedPaymentMethod = await _paymentMethodRepository.save(createdPaymentMethod);

        return savedPaymentMethod;
    }
    async checkSubscription(token: string, requestBody: SubscriptionCheckRequestBody): Promise<boolean> {
        const response = await fetch(`https://api.paypal.com/v1/billing/subscriptions/${requestBody.vendorSubscriptionUUID}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        return response.ok;
    }

    async getToken(): Promise<string> {
        const { clientId, secret } = AppConfigService.getPaypalClientIdAndSecret(this.configService);
        const encodedCredentials = Buffer.from(`${clientId}:${secret}`).toString('base64');

        const response = await fetch('https://api.paypal.com/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${encodedCredentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        const tokenData: PayPalTokenResponse = await response.json();
        return tokenData.access_token;
    }

    async _issueBillingKeyWithBootpay(
        newPaymentMethod: Pick<PaymentMethod, 'creditCard'> & Partial<Pick<PaymentMethod, 'teams'>>,
        buyer: Buyer,
        orderUUID: string
    ): Promise<Billing> {

        let billing: Billing | null = null;

        try {
            const bootpayService = new BootpayService();

            await bootpayService.init(this.bootpayConfiguration);

            await bootpayService.issueBillingKey(
                orderUUID,
                buyer.name,
                newPaymentMethod.creditCard,
                buyer
            );

            billing = bootpayService.billing;

        } catch (error: unknown) {

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

    private getHeaders(): { [header: string]: string } {
        const {
            clientId,
            secret
        } = AppConfigService.getPaypalClientIdAndSecret(this.configService);
        const encodedCredentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
        return {
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        };
    }
}
