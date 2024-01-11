import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Observable, from, map, mergeMap } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { AppConfigService } from '@config/app-config.service';
import { Role } from '@interfaces/profiles/role.enum';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { BootpayConfiguration } from '@services/payments/bootpay/bootpay-configuration.interface';
import { ProfilesService } from '@services/profiles/profiles.service';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { Team } from '@entity/teams/team.entity';

@Injectable()
export class PaymentMethodService {
    constructor(
        private readonly configService: ConfigService,
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
        newPaymentMethod: Pick<PaymentMethod, 'creditCard'> & Partial<Pick<PaymentMethod, 'teams'>>
    ): Observable<PaymentMethod> {

        newPaymentMethod.teams = [{ id: teamId }] as Team[];

        return from(this.profilesService.fetch({
            teamId,
            role: Role.OWNER,
            withUserData: true
        })).pipe(
            map((ownerProfile) => {

                const ownerName = ownerProfile.name
                    || ownerProfile.user.email
                    || ownerProfile.user.phone;

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
                this.datasource.transaction((transactionManager) =>
                    this._create(
                        transactionManager,
                        newPaymentMethod,
                        buyer,
                        ownerUUID
                    )
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

        await bootpayService.init(this.bootpayConfiguration);

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
