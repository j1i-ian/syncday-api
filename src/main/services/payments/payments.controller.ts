/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { PaymentTransaction } from '@entity/payments/payment-transaction.entity';
import { CreatePaymentDto } from '@dto/payments/create-payment.dto';
import { UpdatePaymentDto } from '@dto/payments/update-payment.dto';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Get()
    findAll(): PaymentTransaction[] {
        return this.paymentsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string): PaymentTransaction {
        return this.paymentsService.findOne(+id);
    }

    @Post()
    create(@Body() createPaymentDto: CreatePaymentDto): PaymentTransaction {
        return this.paymentsService.create(createPaymentDto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto): boolean {
        return this.paymentsService.update(+id, updatePaymentDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string): boolean {
        return this.paymentsService.remove(+id);
    }
}
