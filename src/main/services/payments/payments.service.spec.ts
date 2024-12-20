import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { PaymentType } from '@interfaces/payments/payment-type.enum';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { PaymentRedisRepository } from '@services/payments/payment.redis-repository';
import { BootpayPGPaymentStatus } from '@services/payments/bootpay-pg-payment-status.enum';
import { PaypalService } from '@services/payments/paypal/paypal.service';
import { Payment } from '@entity/payments/payment.entity';
import { Order } from '@entity/orders/order.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { User } from '@entity/users/user.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TestMockUtil } from '@test/test-mock-util';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment, import/no-internal-modules
import { ReceiptResponseParameters } from '@bootpay/backend-js/lib/response';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
    let service: PaymentsService;

    let module: TestingModule;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let bootpayServiceRefundStub: sinon.SinonStub;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let paypalServiceStub: sinon.SinonStubbedInstance<PaypalService>;

    let paymentRepositoryStub: sinon.SinonStubbedInstance<Repository<Payment>>;

    let paymentRedisRepository: sinon.SinonStubbedInstance<PaymentRedisRepository>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        paypalServiceStub = sinon.createStubInstance(PaypalService);

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
                    provide: PaypalService,
                    useValue: paypalServiceStub
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
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: TestMockUtil.getLoggerStub()
                }
            ]
        }).compile();

        service = module.get<PaymentsService>(PaymentsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test payment creating', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            paymentRepositoryStub.create.reset();
            paymentRepositoryStub.save.reset();

            paymentRedisRepository.setPGPaymentResult.reset();

            serviceSandbox.restore();
        });

        it('should be saved a payment with transactional interface', async () => {

            const prorationMock = 0;
            const orderMock = stubOne(Order);
            const paymentMethodMock = stubOne(PaymentMethod, {
                type: PaymentType.BILLING_KEY
            });
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

            const __placeOrderStub = serviceSandbox.stub(service, '__placeOrder');

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
            expect(__placeOrderStub.called).true;
        });
    });

    describe('Payment Save Test', () => {
        afterEach(() => {
            paymentRepositoryStub.create.reset();
            paymentRepositoryStub.save.reset();
        });

        it('should be saved a payment entity with transaction', async () => {

            const orderMock = stubOne(Order);
            const proratedRefundUnitPriceMock = 5000;

            paymentRepositoryStub.create.returnsArg(0);
            paymentRepositoryStub.save.resolvesArg(0);

            const result = await firstValueFrom(service._save(
                datasourceMock as unknown as EntityManager,
                orderMock,
                proratedRefundUnitPriceMock
            ));

            expect(result).ok;
            expect(paymentRepositoryStub.create.called).ok;
            expect(paymentRepositoryStub.save.called).ok;
        });
    });

    describe('Test payment refund with bootpay', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            bootpayServiceRefundStub = serviceSandbox.stub(BootpayService.prototype, 'refund');
            bootpayServiceRefundStub.resolves({} as any);


            paymentRedisRepository.setPGPaymentResult.resolves(true);
        });

        afterEach(() => {
            bootpayServiceRefundStub.reset();

            paymentRedisRepository.getPGPaymentResult.reset();
            paymentRedisRepository.setPGPaymentResult.reset();

            serviceSandbox.restore();
        });

        it('should be refunded a payment with bootpay', async () => {

            const orderMock = stubOne(Order);
            const refundUnitPriceMock = 5000;
            const cancelerMock = stubOne(Profile).name as string;
            const messageMock = '';

            paymentRedisRepository.getPGPaymentResult.resolves({ receipt_id: '' } as ReceiptResponseParameters);

            const refundSuccess = await firstValueFrom(service._refund(
                orderMock,
                cancelerMock,
                messageMock,
                refundUnitPriceMock,
                false
            ));

            expect(refundSuccess).ok;

            expect(bootpayServiceRefundStub.called).true;

            expect(paymentRedisRepository.getPGPaymentResult.called).true;
            expect(paymentRedisRepository.setPGPaymentResult.called).true;
        });

        it('should be refunded a payment without bootpay transaction', async () => {

            const orderMock = stubOne(Order);
            const refundUnitPriceMock = 5000;
            const cancelerMock = stubOne(Profile).name as string;
            const messageMock = '';

            paymentRedisRepository.getPGPaymentResult.resolves({ status: BootpayPGPaymentStatus.CANCELLED, receipt_id: '' } as ReceiptResponseParameters);


            const refundSuccess = await firstValueFrom(service._refund(
                orderMock,
                cancelerMock,
                messageMock,
                refundUnitPriceMock,
                false
            ));

            expect(refundSuccess).true;

            expect(bootpayServiceRefundStub.called).false;

            expect(paymentRedisRepository.getPGPaymentResult.called).true;
            expect(paymentRedisRepository.setPGPaymentResult.called).false;
        });
    });
});
