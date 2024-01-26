import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Buyer } from '@interfaces/payments/buyer.interface';
import { Billing } from '@interfaces/payments/billing.interface';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { PaymentMethod } from '@entities/payments/payment-method.entity';
import { User } from '@entities/users/user.entity';
import { Order } from '@entities/orders/order.entity';
import { Team } from '@entities/teams/team.entity';
import { Profile } from '@entities/profiles/profile.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { BootpayException } from '@exceptions/bootpay.exception';
import { PaymentMethodService } from './payment-method.service';

describe('PaymentMethodService', () => {
    let service: PaymentMethodService;

    let module: TestingModule;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let bootpayServiceInitStub: sinon.SinonStub;
    let bootpayServiceIssueBillingKeyStub: sinon.SinonStub;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let profilesServiceStub: sinon.SinonStubbedInstance<ProfilesService>;

    let paymentMethodRepositoryStub: sinon.SinonStubbedInstance<Repository<PaymentMethod>>;

    beforeEach(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        profilesServiceStub = sinon.createStubInstance(ProfilesService);

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

            bootpayServiceInitStub = serviceSandbox.stub(BootpayService.prototype, 'init');
            bootpayServiceIssueBillingKeyStub = serviceSandbox.stub(BootpayService.prototype, 'issueBillingKey');
            serviceSandbox.stub(BootpayService.prototype, 'billing').get(() => ({
                key: '',
                expireAt: new Date()
            } as Billing));
        });

        afterEach(() => {
            paymentMethodRepositoryStub.save.reset();

            bootpayServiceInitStub.reset();
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

            expect(bootpayServiceInitStub.called).true;
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
            bootpayServiceIssueBillingKeyStub.throws({
                error_code: 'RC_USER_EMAIL_INVALID',
                message: 'user 필드에 회원정보 이메일이 포맷에 맞지 않습니다.'
            });

            await expect(service._create(
                datasourceMock as unknown as EntityManager,
                paymentMethodMockStub,
                buyerMock,
                orderUUIDMock
            )).rejectedWith(BootpayException);

            expect(bootpayServiceInitStub.called).true;
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
