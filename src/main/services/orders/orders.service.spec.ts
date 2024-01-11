import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OrderStatus } from '@interfaces/orders/order-status.enum';
import { Order } from '@entity/orders/order.entity';
import { Product } from '@entity/products/product.entity';
import { Team } from '@entity/teams/team.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
    let service: OrdersService;

    let module: TestingModule;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);
    let orderRepositoryStub: sinon.SinonStubbedInstance<Repository<Order>>;

    beforeEach(async () => {

        orderRepositoryStub = sinon.createStubInstance<Repository<Order>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                OrdersService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(Order),
                    useValue: orderRepositoryStub
                }
            ]
        }).compile();

        service = module.get<OrdersService>(OrdersService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test order creating with product', () => {

        beforeEach(() => {
            orderRepositoryStub.create.reset();
            orderRepositoryStub.save.reset();
        });

        it('should be created a new order entity', async () => {
            const unit = 3;
            const orderStub = stubOne(Order, {
                unit
            });
            const productMock = stubOne(Product, {
                price: 1000
            });
            const teamIdMock = stubOne(Team).id;
            const expectedTotalPrice = productMock.price * orderStub.unit;
            const expectedMemo = `${productMock.name}, ${productMock.price} * ${orderStub.unit} = ${expectedTotalPrice}`;
            const createOrderStub = stubOne(Order, {
                unit,
                amount: expectedTotalPrice,
                memo: expectedMemo,
                status: OrderStatus.CHECKOUT
            });

            orderRepositoryStub.create.returns(createOrderStub);
            orderRepositoryStub.save.resolves(createOrderStub);

            const placedOrder = await service._create(
                datasourceMock as unknown as EntityManager,
                productMock,
                unit,
                teamIdMock
            );

            expect(placedOrder).ok;
            expect(orderRepositoryStub.create.getCall(0).args[0].memo).contain(expectedMemo);

            expect(orderRepositoryStub.create.called).true;
            expect(orderRepositoryStub.save.called).true;
        });
    });

    describe('Test order updating status', () => {

        it('should be updated order status with transaction', async () => {

            const orderIdMock = stubOne(Order).id;
            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            orderRepositoryStub.update.resolves(updateResultStub);

            const updateSuccess = await service._updateOrderStatus(
                datasourceMock as unknown as EntityManager,
                orderIdMock,
                OrderStatus.PLACED
            );

            expect(updateSuccess).true;

        });

    });
});
