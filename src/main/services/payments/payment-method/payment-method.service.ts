import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Observable, defer, from, map, mergeMap } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { Billing } from '@core/interfaces/payments/billing.interface';
import { AppConfigService } from '@config/app-config.service';
import { Role } from '@interfaces/profiles/role.enum';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { ProfilesService } from '@services/profiles/profiles.service';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { Team } from '@entity/teams/team.entity';
import { BootpayException } from '@exceptions/bootpay.exception';
import { InternalBootpayException } from '@exceptions/internal-bootpay.exception';

@Injectable()
export class PaymentMethodService {
    constructor(
        private readonly configService: ConfigService,
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
        return defer(() => from(this.paymentMethodRepository.findOneOrFail({
            relations: {
                teams: true
            },
            where: {
                teams: {
                    id: teamId
                }
            }
        })));
    }

    create(
        teamId: number,
        newPaymentMethod: Pick<PaymentMethod, 'creditCard'> & Partial<Pick<PaymentMethod, 'teams'>>
    ): Observable<PaymentMethod> {

        newPaymentMethod.teams = [{ id: teamId }] as Team[];

        return defer(() => from(this.profilesService.fetch({
            teamId,
            role: Role.OWNER,
            withUserData: true
        }))).pipe(
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
                    uuid: ownerProfile.uuid
                };
            }),
            mergeMap(({ buyer, uuid: ownerUUID }) =>
                defer(() => from(this.datasource.transaction((transactionManager) =>
                    this._create(
                        transactionManager,
                        newPaymentMethod,
                        buyer,
                        ownerUUID
                    )
                )))
            )
        );
    }

    async _create(
        transactionManager: EntityManager,
        newPaymentMethod: Pick<PaymentMethod, 'creditCard'> & Partial<Pick<PaymentMethod, 'teams'>>,
        buyer: Buyer,
        orderUUID: string
    ): Promise<PaymentMethod> {

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

        const _paymentMethodRepository = transactionManager.getRepository(PaymentMethod);

        const createdPaymentMethod = _paymentMethodRepository.create(newPaymentMethod);

        createdPaymentMethod.billing = billing as unknown as Billing;

        if (newPaymentMethod.teams) {
            createdPaymentMethod.teams = newPaymentMethod.teams;
        }

        const savedPaymentMethod = await _paymentMethodRepository.save(createdPaymentMethod);

        return savedPaymentMethod;
    }

    update(
        id: number,
        teamId: number,
        updatePaymentMethod: Pick<PaymentMethod, 'creditCard'>
    ): Observable<boolean> {
        return defer(() => from(this.paymentMethodRepository.findOneByOrFail({
            id,
            teams: { id: teamId }
        }))).pipe(
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
