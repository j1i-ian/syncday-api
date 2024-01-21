import { ClassSerializerInterceptor, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { routes } from '@config/routes';
import { AppConfigService } from '@config/app-config.service';
import { UserModule } from '@services/users/user.module';
import { SyncdayAwsSdkClientModule } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.module';
import { TeamSettingModule } from '@services/team/team-setting/team-setting.module';
import { TemporaryUsersModule } from '@services/users/temporary-users/temporary-users.module';
import { PaymentMethodModule } from '@services/payments/payment-method/payment-method.module';
import { GlobalExceptionFilter } from '@app/filters/global-exception.filter';
import { RolesGuard } from '@app/auth/roles.guard';
import { GlobalInterceptor } from '@app/interceptors/global/global.interceptor';
import { ClusterModule } from '@liaoliaots/nestjs-redis';
import { AppController } from './app.controller';
import { AuthModule } from './main/auth/auth.module';
import { JwtAuthGuard } from './main/auth/strategy/jwt/jwt-auth.guard';
import { UtilModule } from './main/services/util/util.module';
import { IntegrationsModule } from './main/services/integrations/integrations.module';
import { AvailabilityModule } from './main/services/availability/availability.module';
import { EventsModule } from './main/services/events/events.module';
import { BookingsModule } from './main/services/bookings/bookings.module';
import { ScheduledEventsModule } from './main/services/scheduled-events/scheduled-events.module';
import { OAuth2Module } from './main/services/oauth2/oauth2.module';
import { TeamModule } from './main/services/team/team.module';
import { ProfilesModule } from './main/services/profiles/profiles.module';
import { PaymentsModule } from './main/services/payments/payments.module';
import { OrdersModule } from './main/services/orders/orders.module';
import { ProductsModule } from './main/services/products/products.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: AppConfigService.getDotenvConfigs()
        }),
        RouterModule.register(routes),
        TypeOrmModule.forRootAsync(AppConfigService.getDatabaseConfigs()),
        WinstonModule.forRootAsync(AppConfigService.getWinstonModuleSetting()),
        ClusterModule.forRootAsync(AppConfigService.getRedisModuleOptions()),

        UserModule,
        TemporaryUsersModule,
        TeamModule,
        TeamSettingModule,

        AuthModule,

        UtilModule,

        IntegrationsModule,

        AvailabilityModule,

        EventsModule,

        SyncdayAwsSdkClientModule,
        BookingsModule,
        ScheduledEventsModule,
        OAuth2Module,
        ProfilesModule,
        PaymentsModule,
        PaymentMethodModule,
        OrdersModule,
        ProductsModule
    ],
    controllers: [AppController],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: ClassSerializerInterceptor
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: GlobalInterceptor
        },
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter
        },
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard
        },
        {
            provide: APP_PIPE,
            useFactory: () =>
                new ValidationPipe({
                    transform: true,
                    transformOptions: {
                        strategy: 'excludeAll',
                        excludeExtraneousValues: true,
                        exposeUnsetFields: false
                    }
                })
        }
    ]
})
export class AppModule {}
