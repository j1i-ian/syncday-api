import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Buyer } from '@core/interfaces/payments/buyer.interface';
import { Billing } from '@core/interfaces/payments/billing.interface';
import { BootpayService } from '@services/payments/bootpay/bootpay.service';
import { ProfilesService } from '@services/profiles/profiles.service';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { User } from '@entity/users/user.entity';
import { Order } from '@entity/orders/order.entity';
import { Team } from '@entity/teams/team.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TestMockUtil } from '@test/test-mock-util';
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
    });

});
