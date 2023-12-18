import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { EntityManager, Repository } from 'typeorm';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { PaymentMethodService } from './payment-method.service';

describe('PaymentMethodService', () => {
    let service: PaymentMethodService;

    let module: TestingModule;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let paymentMethodRepositoryStub: sinon.SinonStubbedInstance<Repository<PaymentMethod>>;

    beforeEach(async () => {

        paymentMethodRepositoryStub = sinon.createStubInstance<Repository<PaymentMethod>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                PaymentMethodService,
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

    describe('Test payment method creating', () => {
        afterEach(() => {
            paymentMethodRepositoryStub.save.reset();
        });

        it('should be saved a payment method', async () => {

            const paymentMethodMockStub = stubOne(PaymentMethod);

            paymentMethodRepositoryStub.save.resolves(paymentMethodMockStub);

            const saved = await firstValueFrom(service.create(paymentMethodMockStub));

            expect(saved).ok;
            expect(saved).deep.equals(paymentMethodMockStub);
            expect(paymentMethodRepositoryStub.save.called).true;
        });

        it('should be saved a payment method with transactional interface', async () => {

            const paymentMethodMockStub = stubOne(PaymentMethod);

            paymentMethodRepositoryStub.save.resolves(paymentMethodMockStub);

            const saved = await service._create(
                datasourceMock as unknown as EntityManager,
                paymentMethodMockStub
            );

            expect(saved).ok;
            expect(saved).deep.equals(paymentMethodMockStub);
            expect(paymentMethodRepositoryStub.save.called).true;
        });
    });

});
