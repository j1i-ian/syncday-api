import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Payment } from '@entity/payments/payment.entity';
import { Order } from '@entity/orders/order.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
    let service: PaymentsService;

    let module: TestingModule;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let paymentRepositoryStub: sinon.SinonStubbedInstance<Repository<Payment>>;

    beforeEach(async () => {

        paymentRepositoryStub = sinon.createStubInstance<Repository<Payment>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                PaymentsService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(Payment),
                    useValue: paymentRepositoryStub
                }
            ]
        }).compile();

        service = module.get<PaymentsService>(PaymentsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test payment method creating', () => {
        afterEach(() => {
            paymentRepositoryStub.create.reset();
            paymentRepositoryStub.save.reset();
        });

        it('should be saved a payment method with transactional interface', async () => {

            const orderMock = stubOne(Order);
            const paymentMethodMock = stubOne(PaymentMethod);
            const paymentStub = stubOne(Payment, {
                amount: orderMock.price,
                orderId: orderMock.id
            });

            paymentRepositoryStub.create.returns(paymentStub);
            paymentRepositoryStub.save.resolves(paymentStub);

            const saved = await service._create(
                datasourceMock as unknown as EntityManager,
                orderMock,
                paymentMethodMock
            );

            expect(saved).ok;
            expect(saved).deep.equals(paymentStub);
            expect(paymentRepositoryStub.create.called).true;
            expect(paymentRepositoryStub.save.called).true;
        });
    });
});
