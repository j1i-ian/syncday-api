import { Injectable } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, In, IsNull, Raw, Repository } from 'typeorm';
import { Observable, defer, from, map, mergeMap, of } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderStatus } from '@interfaces/orders/order-status.enum';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { Order } from '@entity/orders/order.entity';
import { Product } from '@entity/products/product.entity';
import { OrderOption } from '@entity/orders/order-option.entity';

@Injectable()
export class OrdersService {

    constructor(
        @InjectRepository(Order)
        private readonly orderRepository: Repository<Order>
    ) {}

    search({
        ids,
        teamId,
        page = 0,
        take = 50
    }: Partial<{
        ids: number[];
        teamId: number;
        page: number;
        take: number;
    }>): Observable<Order[]> {

        let findOptionsWhere: FindOptionsWhere<Order> = {};

        if (ids) {
            findOptionsWhere = {
                id: In(ids)
            };
        }

        if (teamId) {
            findOptionsWhere = {
                ...findOptionsWhere,
                teamId
            };
        }

        const skip = page * take;

        return from(this.orderRepository.find({
            where: findOptionsWhere,
            order: {
                createdAt: 'DESC'
            },
            skip,
            take
        }));
    }

    fetch(searchOptions: {
        id?: number;
        teamId?: number;
        productId?: number;
        orderOption?: OrderOption;
    }): Observable<Order | null> {

        const {
            id,
            teamId,
            productId,
            orderOption
        } = searchOptions;

        let findOptionsWhere: FindOptionsWhere<Order> = {};

        if(id) {
            findOptionsWhere.id = id;
        }

        if(teamId) {
            findOptionsWhere.teamId = searchOptions.teamId;
        }

        if (productId) {
            findOptionsWhere.productId = searchOptions.productId;
        }

        if (orderOption) {

            const hasProfileIds = orderOption.profileIds && orderOption.profileIds.length > 0;
            const profileIdsOptionRawOperator = hasProfileIds ?
                Raw((alias) =>
                    (orderOption.profileIds as number[])
                        .map(
                            (profileId) => `FIND_IN_SET('${profileId}', ${alias})`
                        ).join(' OR ')
                ) : IsNull();

            const hasTeamId = !!orderOption.teamId;
            const teamIdOptionOperator = hasTeamId ? orderOption.teamId : IsNull();

            findOptionsWhere = {
                ...findOptionsWhere,
                option: {
                    teamId: teamIdOptionOperator,
                    profileIds: profileIdsOptionRawOperator
                }
            } as FindOptionsWhere<Order>;
        }

        return from(defer(() => this.orderRepository.findOne({
            relations: ['team'],
            where: findOptionsWhere
        })));
    }

    async _create(
        transactionManager: EntityManager,
        product: Product,
        unit: number,
        option: OrderOption,
        teamId: number,
        proration = 0,
        orderer?: Orderer
    ): Promise<Order> {
        const orderRepository = transactionManager.getRepository(Order);

        const totalPrice = product.price * unit - proration;
        const memo = `${product.name}, ${product.price} * ${unit} - ${proration} = ${totalPrice}`;

        const createdOrder = orderRepository.create({
            name: product.name,
            unit,
            amount: totalPrice,
            option,
            productId: product.id,
            status: OrderStatus.CHECKOUT,
            memo,
            orderer,
            teamId
        });

        const savedOrder = await orderRepository.save(createdOrder);

        return savedOrder;
    }

    _update(
        transactionManager: EntityManager,
        orderId: number,
        partialOrder: Partial<Omit<Order, 'status'>>
    ): Observable<boolean> {

        return of(transactionManager.getRepository(Order))
            .pipe(
                mergeMap((orderRepository) => orderRepository.update(orderId, partialOrder)),
                map((updateResult) => !!(updateResult.affected && updateResult.affected > 0))
            );
    }

    async _updateOrderStatus(
        transactionManager: EntityManager,
        orderId: number,
        orderStatus: OrderStatus
    ): Promise<boolean> {
        const orderRepository = transactionManager.getRepository(Order);

        const updateResult = await orderRepository.update(orderId, {
            status: orderStatus
        });

        return !!(updateResult.affected && updateResult.affected > 0);
    }
}
