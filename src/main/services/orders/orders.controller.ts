import { Controller, Get } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { Order } from '@interfaces/orders/order';
import { Role } from '@interfaces/profiles/role.enum';
import { OrdersService } from '@services/orders/orders.service';

@Controller()
export class OrdersController {

    constructor(
        private readonly ordersService: OrdersService
    ) {}

    @Get()
    @Roles(Role.OWNER, Role.MANAGER)
    search(
        @AuthProfile('teamId') teamId: number
    ): Observable<Order[]> {
        return this.ordersService.search({
            teamId,
            page: 0,
            take: 50
        });
    }
}
