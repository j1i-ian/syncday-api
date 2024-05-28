import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { Billing } from '@core/interfaces/payments/billing.interface';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { PaypalService } from '@services/payments/paypal/paypal.service';
import { OrdersService } from '@services/orders/orders.service';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { User } from '@entity/users/user.entity';
import { Order } from '@entity/orders/order.entity';
import { Team } from '@entity/teams/team.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { BootpayException } from '@exceptions/bootpay.exception';
import { PaymentMethodService } from './payment-method.service';

describe('PaymentMethodService', () => {
    let service: PaymentMethodService;

    let module: TestingModule;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let bootpayServiceIssueBillingKeyStub: sinon.SinonStub;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let profilesServiceStub: sinon.SinonStubbedInstance<ProfilesService>;
    let paypalServiceStub: sinon.SinonStubbedInstance<PaypalService>;
    let orderServiceStub: sinon.SinonStubbedInstance<OrdersService>;

    let paymentMethodRepositoryStub: sinon.SinonStubbedInstance<Repository<PaymentMethod>>;

    beforeEach(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        profilesServiceStub = sinon.createStubInstance(ProfilesService);
        paypalServiceStub = sinon.createStubInstance(PaypalService);
        orderServiceStub = sinon.createStubInstance(OrdersService);

        paymentMethodRepositoryStub = sinon.createStubInstance<Repository<PaymentMethod>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                PaymentMethodService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: ProfilesService,
                    useValue: profilesServiceStub
                },
                {
                    provide: PaypalService,
                    useValue: paypalServiceStub
                },
                {
                    provide: OrdersService,
                    useValue: orderServiceStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(PaymentMethod),
                    useValue: paymentMethodRepositoryStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: TestMockUtil.getLoggerStub()
                }
            ]
        }).compile();

        service = module.get<PaymentMethodService>(PaymentMethodService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Fetching Payment Method Detail Test', () => {

        afterEach(() => {
            paymentMethodRepositoryStub.findOneOrFail.reset();
        });

        it('should be fecthed the payment method which is connected the given team id', async () => {

            const teamIdMock = stubOne(Team).id;
            const paymentMethodStub = stubOne(PaymentMethod);

            paymentMethodRepositoryStub.findOneOrFail.resolves(paymentMethodStub);

            const loadedPaymentMethod = await firstValueFrom(service.fetch({
                teamId: teamIdMock
            }));

            expect(loadedPaymentMethod).ok;
            expect(paymentMethodRepositoryStub.findOneOrFail.called).true;
        });
    });

    describe('Test payment method creating', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            bootpayServiceIssueBillingKeyStub = serviceSandbox.stub(BootpayService.prototype, '_issueBillingKey');
            serviceSandbox.stub(BootpayService.prototype, 'billing').get(() => ({
                key: '',
                expireAt: new Date()
            } as Billing));
        });

        afterEach(() => {
            paymentMethodRepositoryStub.save.reset();

            bootpayServiceIssueBillingKeyStub.reset();

            serviceSandbox.restore();
        });

        it('should be saved a payment method', async () => {

            const paymentMethodStub = stubOne(PaymentMethod);
            const ownerStub = stubOne(User);
            const ownerProfileStub = stubOne(Profile, {
                user: ownerStub
            });
            const teamIdMock = stubOne(Team).id;

            profilesServiceStub.fetch.resolves(ownerProfileStub);

            const _createdStub = serviceSandbox.stub(service, '_create');
            _createdStub.resolves(paymentMethodStub);

            const saved = await firstValueFrom(service.create(
                teamIdMock,
                paymentMethodStub
            ));

            expect(saved).ok;
            expect(saved).deep.equals(paymentMethodStub);

            expect(profilesServiceStub.fetch.called).true;
            expect(_createdStub.called).true;
        });

        it('should be saved a payment method with transactional interface', async () => {

            const paymentMethodMockStub = stubOne(PaymentMethod);
            const userStub = stubOne(User);
            const buyerMock = {
                name: 'sample',
                email: userStub.email,
                phone: userStub.phone
            } as Buyer;
            const orderUUIDMock = stubOne(Order).uuid;

            paymentMethodRepositoryStub.create.resolves(paymentMethodMockStub);
            paymentMethodRepositoryStub.save.resolves(paymentMethodMockStub);

            const saved = await service._create(
                datasourceMock as unknown as EntityManager,
                paymentMethodMockStub,
                buyerMock,
                orderUUIDMock
            );

            expect(saved).ok;
            expect(saved).deep.equals(paymentMethodMockStub);

            expect(bootpayServiceIssueBillingKeyStub.called).true;

            expect(paymentMethodRepositoryStub.save.called).true;
        });

        it('should be thrown a bootpay exception when bootpay service threw an error ', async () => {

            const paymentMethodMockStub = stubOne(PaymentMethod);
            const userStub = stubOne(User);
            const buyerMock = {
                name: 'sample',
                email: userStub.email,
                phone: userStub.phone
            } as Buyer;
            const orderUUIDMock = stubOne(Order).uuid;

            paymentMethodRepositoryStub.create.resolves(paymentMethodMockStub);
            paymentMethodRepositoryStub.save.resolves(paymentMethodMockStub);

            const bootpayErrorStub = {
                error_code: 'RC_USER_EMAIL_INVALID',
                message: 'user 필드에 회원정보 이메일이 포맷에 맞지 않습니다.'
            };
            const bootpayExceptionStub = new BootpayException(bootpayErrorStub.message);

            bootpayServiceIssueBillingKeyStub.throws(bootpayErrorStub);
            serviceSandbox.stub(BootpayService.prototype, '_toBootpayException')
                .throws(bootpayExceptionStub);

            await expect(service._create(
                datasourceMock as unknown as EntityManager,
                paymentMethodMockStub,
                buyerMock,
                orderUUIDMock
            )).rejectedWith(BootpayException);

            expect(bootpayServiceIssueBillingKeyStub.called).true;

            expect(paymentMethodRepositoryStub.save.called).false;
        });
    });

    describe('Test update payment method', () => {
        it('should be updated a payment method', async () => {

            const teamIdMock = stubOne(Team).id;
            const paymentMethodMockStub = stubOne(PaymentMethod);

            const updateResultMock = TestMockUtil.getTypeormUpdateResultMock();

            paymentMethodRepositoryStub.findOneByOrFail.resolves(paymentMethodMockStub);

            paymentMethodRepositoryStub.update.resolves(updateResultMock);

            const result = await firstValueFrom(
                service.update(
                    paymentMethodMockStub.id,
                    teamIdMock,
                    paymentMethodMockStub
                )
            );

            expect(result).true;

            expect(paymentMethodRepositoryStub.findOneByOrFail.called).true;
            expect(paymentMethodRepositoryStub.update.called).true;
        });
    });
});
