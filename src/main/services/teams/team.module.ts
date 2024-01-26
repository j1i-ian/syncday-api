import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from '@services/payments/payments.module';
import { ProductsModule } from '@services/products/products.module';
import { OrdersModule } from '@services/orders/orders.module';
import { UserModule } from '@services/users/user.module';
import { ProfilesModule } from '@services/profiles/profiles.module';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { EventsModule } from '@services/events/events.module';
import { AvailabilityModule } from '@services/availabilities/availability.module';
import { PaymentMethodModule } from '@services/payments/payment-method/payment-method.module';
import { Team } from '@entities/teams/team.entity';
import { EventGroup } from '@entities/events/event-group.entity';
import { TeamSettingModule } from './team-setting/team-setting.module';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([ Team, EventGroup ]),
        TeamSettingModule,
        forwardRef(() => UserModule),
        ProfilesModule,
        ProductsModule,
        OrdersModule,
        forwardRef(() => NotificationsModule),
        PaymentsModule,
        PaymentMethodModule,
        EventsModule,
        AvailabilityModule
    ],
    controllers: [TeamController],
    providers: [TeamService],
    exports: [TeamService]
})
export class TeamModule {}
