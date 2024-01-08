import { Controller, Get } from '@nestjs/common';
import { Observable, catchError, map, of } from 'rxjs';
import { EntityNotFoundError } from 'typeorm';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { CreditCard } from '@entity/payments/credit-card.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';

type NonSensitivePaymentMethod = Pick<PaymentMethod, 'id'> & { creditCard: Pick<CreditCard, 'serialNumber'> };

@Controller()
export class PaymentMethodController {

    constructor(
        private readonly paymentMethodSevice: PaymentMethodService
    ) {}

    @Get('/team')
    @Roles(Role.OWNER, Role.MANAGER)
    fetchTeamPaymentMethod(
        @AuthProfile('teamId') teamId: number
    ): Observable<NonSensitivePaymentMethod | null> {
        console.log(teamId);
        return this.paymentMethodSevice.fetch({ teamId })
            .pipe(
                map((teamPaymentMethod) => ({
                    id: teamPaymentMethod.id,
                    creditCard: {
                        serialNumber: teamPaymentMethod.creditCard.serialNumber
                    }
                })),
                catchError((error) => {

                    if (error instanceof EntityNotFoundError) {
                        return of(null);
                    } else {
                        throw error;
                    }
                })
            );
    }
}
