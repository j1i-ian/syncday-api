import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from '@services/profiles/profiles.controller';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { UserModule } from '@services/users/user.module';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { OrdersModule } from '@services/orders/orders.module';
import { ProductsModule } from '@services/products/products.module';
import { PaymentsModule } from '@services/payments/payments.module';
import { PaymentMethodModule } from '@services/payments/payment-method/payment-method.module';
import { TeamModule } from '@services/teams/team.module';
import { Profile } from '@entities/profiles/profile.entity';
import { ProfilesService } from './profiles.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([ Profile ]),
        SyncdayRedisModule,
        ProductsModule,
        OrdersModule,
        forwardRef(() => TeamModule),
        forwardRef(() => PaymentsModule),
        forwardRef(() => PaymentMethodModule),
        forwardRef(() => UserModule),
        forwardRef(() => NotificationsModule)
    ],
    controllers: [ProfilesController],
    providers: [ProfilesService, ProfilesRedisRepository],
    exports: [ProfilesService]
})
export class ProfilesModule {}
