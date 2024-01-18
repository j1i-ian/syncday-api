import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { PaymentRedisRepository } from '@services/payments/payment.redis-repository';
import { BootpayPGPaymentStatus } from '@services/payments/bootpay-pg-payment-status.enum';
import { Payment } from '@entity/payments/payment.entity';
import { Order } from '@entity/orders/order.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TestMockUtil } from '@test/test-mock-util';
// eslint-disable-next-line import/no-internal-modules
import { ReceiptResponseParameters } from '@bootpay/backend-js/lib/response';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
    let service: PaymentsService;

    let module: TestingModule;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let bootpayServicePlaceOrderStub: sinon.SinonStub;
    let bootpayServiceRefundStub: sinon.SinonStub;
    let bootpayServiceInitStub: sinon.SinonStub;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;

    let paymentRepositoryStub: sinon.SinonStubbedInstance<Repository<Payment>>;

    let paymentRedisRepository: sinon.SinonStubbedInstance<PaymentRedisRepository>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);

        paymentRepositoryStub = sinon.createStubInstance<Repository<Payment>>(Repository);

        paymentRedisRepository = sinon.createStubInstance(PaymentRedisRepository);

        module = await Test.createTestingModule({
            providers: [
                PaymentsService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: PaymentRedisRepository,
                    useValue: paymentRedisRepository
                },
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
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            bootpayServicePlaceOrderStub = serviceSandbox.stub(BootpayService.prototype, 'placeOrder');

            bootpayServiceInitStub = serviceSandbox.stub(BootpayService.prototype, 'init');
        });

        afterEach(() => {
            paymentRepositoryStub.create.reset();
            paymentRepositoryStub.save.reset();

            bootpayServicePlaceOrderStub.reset();
            bootpayServiceInitStub.reset();

            paymentRedisRepository.setPGPaymentResult.reset();

            serviceSandbox.restore();
        });

        it('should be saved a payment method with transactional interface', async () => {

            const prorationMock = 0;
            const orderMock = stubOne(Order);
            const paymentMethodMock = stubOne(PaymentMethod);
            const paymentStub = stubOne(Payment, {
                amount: orderMock.amount,
                orderId: orderMock.id
            });
            const userStub = stubOne(User);
            const buyerMock = {
                name: 'sample',
                email: userStub.email,
                phone: userStub.phone
            } as Buyer;

            paymentRepositoryStub.create.returns(paymentStub);
            paymentRepositoryStub.save.resolves(paymentStub);

            const saved = await service._create(
                datasourceMock as unknown as EntityManager,
                prorationMock,
                orderMock,
                paymentMethodMock,
                buyerMock
            );

            expect(saved).ok;
            expect(saved).deep.equals(paymentStub);

            expect(paymentRepositoryStub.create.called).true;
            expect(paymentRepositoryStub.save.called).true;

            expect(bootpayServicePlaceOrderStub.called).true;
            expect(bootpayServiceInitStub.called).true;

            expect(paymentRedisRepository.setPGPaymentResult.called).true;
        });
    });

    describe('Test payment method refund', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            bootpayServiceRefundStub = serviceSandbox.stub(BootpayService.prototype, 'refund');

            bootpayServiceInitStub = serviceSandbox.stub(BootpayService.prototype, 'init');
        });

        afterEach(() => {
            paymentRepositoryStub.create.reset();
            paymentRepositoryStub.save.reset();

            bootpayServiceRefundStub.reset();
            bootpayServiceInitStub.reset();

            paymentRedisRepository.getPGPaymentResult.reset();
            paymentRedisRepository.setPGPaymentResult.reset();

            serviceSandbox.restore();
        });

        it('should be refunded a payment with transaction', async () => {

            const orderMock = stubOne(Order);
            const paymentStub = stubOne(Payment, {
                amount: orderMock.amount,
                orderId: orderMock.id
            });
            const refundUnitPriceMock = 5000;
            const cancelerMock = stubOne(Profile).name as string;
            const messageMock = '';

            paymentRepositoryStub.create.returns(paymentStub);

            paymentRedisRepository.getPGPaymentResult.resolves({ receipt_id: '' } as ReceiptResponseParameters);

            paymentRepositoryStub.save.resolves(paymentStub);

            const refundedPayment = await service._refund(
                datasourceMock as unknown as EntityManager,
                orderMock,
                cancelerMock,
                messageMock,
                refundUnitPriceMock,
                false
            );

            expect(refundedPayment).ok;
            expect(refundedPayment).deep.equals(paymentStub);

            expect(paymentRepositoryStub.create.called).true;
            expect(paymentRepositoryStub.save.called).true;

            expect(bootpayServiceRefundStub.called).true;
            expect(bootpayServiceInitStub.called).true;

            expect(paymentRedisRepository.getPGPaymentResult.called).true;
            expect(paymentRedisRepository.setPGPaymentResult.called).true;
        });

        it('should be refunded a payment without bootpay transaction', async () => {

            const orderMock = stubOne(Order);
            const paymentStub = stubOne(Payment, {
                amount: orderMock.amount,
                orderId: orderMock.id
            });
            const refundUnitPriceMock = 5000;
            const cancelerMock = stubOne(Profile).name as string;
            const messageMock = '';

            paymentRepositoryStub.create.returns(paymentStub);

            paymentRedisRepository.getPGPaymentResult.resolves({ status: BootpayPGPaymentStatus.CANCELLED, receipt_id: '' } as ReceiptResponseParameters);

            paymentRepositoryStub.save.resolves(paymentStub);

            const refundedPayment = await service._refund(
                datasourceMock as unknown as EntityManager,
                orderMock,
                cancelerMock,
                messageMock,
                refundUnitPriceMock,
                false
            );

            expect(refundedPayment).ok;
            expect(refundedPayment).deep.equals(paymentStub);

            expect(paymentRepositoryStub.create.called).true;
            expect(paymentRepositoryStub.save.called).true;

            expect(bootpayServiceRefundStub.called).false;
            expect(bootpayServiceInitStub.called).false;

            expect(paymentRedisRepository.getPGPaymentResult.called).true;
            expect(paymentRedisRepository.setPGPaymentResult.called).false;
        });
    });
});
