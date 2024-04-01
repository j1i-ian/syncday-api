import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from '@services/payments/payments.module';
import { ProductsModule } from '@services/products/products.module';
import { OrdersModule } from '@services/orders/orders.module';
import { UserModule } from '@services/users/user.module';
import { ProfilesModule } from '@services/profiles/profiles.module';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { EventsModule } from '@services/events/events.module';
import { AvailabilityModule } from '@services/availability/availability.module';
import { PaymentMethodModule } from '@services/payments/payment-method/payment-method.module';
import { TeamRedisRepository } from '@services/team/team.redis-repository';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { Team } from '@entity/teams/team.entity';
import { EventGroup } from '@entity/events/event-group.entity';
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
        AvailabilityModule,
        SyncdayRedisModule
    ],
    controllers: [TeamController],
    providers: [TeamService, TeamRedisRepository],
    exports: [TeamService, TeamRedisRepository]
})
export class TeamModule {}
