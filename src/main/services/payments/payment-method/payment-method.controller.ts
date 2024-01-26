import { Body, Controller, Get, Header, Param, Post, Put } from '@nestjs/common';
import { Observable, catchError, map, of } from 'rxjs';
import { EntityNotFoundError } from 'typeorm';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { PaymentMethodService } from '@services/payments/payment-method/payment-method.service';
import { CreditCard } from '@entities/payments/credit-card.entity';
import { PaymentMethod } from '@entities/payments/payment-method.entity';
import { PaymentMethodRequestDto } from '@dto/payments/payment-method-request.dto';

type NonSensitivePaymentMethod = Pick<PaymentMethod, 'id'> & { creditCard: Pick<CreditCard, 'serialNumber'> };

@Controller()
@Roles(Role.OWNER, Role.MANAGER)
export class PaymentMethodController {

    constructor(
        private readonly paymentMethodSevice: PaymentMethodService
    ) {}

    @Get('/team')
    fetchTeamPaymentMethod(
        @AuthProfile('teamId') teamId: number
    ): Observable<NonSensitivePaymentMethod | null> {
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

    /**
     * @param teamId
     * @param createPaymentMethodRequestDto
     * @returns {boolean} Don't expose sensitive information, so returns true
     */
    @Post()
    @Header('Content-type', 'application/json')
    create(
        @AuthProfile('teamId') teamId: number,
        @Body() createPaymentMethodRequestDto: PaymentMethodRequestDto
    ): Observable<boolean> {
        return this.paymentMethodSevice.create(teamId, createPaymentMethodRequestDto as PaymentMethod)
            .pipe(map(() => true));
    }

    /**
     * @param teamId
     * @param updatePaymentMethodRequestDto
     * @returns {boolean} Don't expose sensitive information, so returns true
     */
    @Put(':paymentMethodId(\\d+)')
    @Roles(Role.OWNER, Role.MANAGER)
    @Header('Content-type', 'application/json')
    update(
        @AuthProfile('teamId') teamId: number,
        @Param('paymentMethodId') paymentMethodId: number,
        @Body() updatePaymentMethodRequestDto: PaymentMethodRequestDto
    ): Observable<boolean> {
        return this.paymentMethodSevice.update(
            paymentMethodId,
            teamId,
            updatePaymentMethodRequestDto as PaymentMethod
        );
    }
}
