/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { PaymentTransaction } from '@entity/payments/payment-transaction.entity';
import { CreatePaymentDto } from '@dto/payments/create-payment.dto';
import { UpdatePaymentDto } from '@dto/payments/update-payment.dto';

@Injectable()
export class PaymentsService {
    findAll(): PaymentTransaction[] {
        return [] as PaymentTransaction[];
    }

    findOne(id: number): PaymentTransaction {
        return {} as PaymentTransaction;
    }
    create(createPaymentDto: CreatePaymentDto): PaymentTransaction {
        return {} as PaymentTransaction;
    }

    update(id: number, updatePaymentDto: UpdatePaymentDto): boolean {
        return true;
    }

    remove(id: number): boolean {
        return true;
    }
}
