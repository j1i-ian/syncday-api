import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
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

    it('should be searched the order list', async () => {

        const teamIdMock = 1;

        const orderStubs = stub(Order);

        orderRepositoryStub.find.resolves(orderStubs);

        const loadedOrders = await firstValueFrom(service.search({
            teamId: teamIdMock,
            page: 0,
            take: 50
        }));

        expect(loadedOrders).ok;
        expect(loadedOrders.length).greaterThan(0);
    });

    it('should be found an order by team id', async () => {

        const teamIdMock = 1;
        const productIdMock = 1;
        const orderStub = stubOne(Order);

        orderRepositoryStub.findOne.resolves(orderStub);

        const loaded = await firstValueFrom(service.fetch({
            teamId: teamIdMock,
            productId: productIdMock
        }));

        expect(loaded).ok;
        expect(orderRepositoryStub.findOne.called).true;
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

            const prorationMock = productMock.price * orderStub.unit;
            const expectedTotalPrice = prorationMock;
            const expectedMemo = `${productMock.name}, ${productMock.price} * ${orderStub.unit} - 0 = ${expectedTotalPrice}`;
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
                { teamId: teamIdMock },
                teamIdMock,
                prorationMock
            );

            expect(placedOrder).ok;
            expect(orderRepositoryStub.create.getCall(0).args[0].memo).contain(expectedMemo);

            expect(orderRepositoryStub.create.called).true;
            expect(orderRepositoryStub.save.called).true;
        });
    });

    describe('Order Update Test', () => {

        afterEach(() => {
            orderRepositoryStub.update.reset();
        });

        it('should be updated an order', async () => {
            const orderMockStub = stubOne(Order);
            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            orderRepositoryStub.update.resolves(updateResultStub);

            await firstValueFrom(
                service._update(
                    datasourceMock as unknown as EntityManager,
                    orderMockStub.id,
                    orderMockStub
                )
            );

            expect(orderRepositoryStub.update.called).true;
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
