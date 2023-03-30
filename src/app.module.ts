import { ClassSerializerInterceptor, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, RouterModule } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { routes } from '@config/routes';
import { AppConfigService } from '@config/app-config.service';
import { UserModule } from '@services/users/user.module';
import { GlobalExceptionFilter } from '@app/filters/global-exception.filter';
import { AuthModule } from './main/auth/auth.module';
import { EventGroupsModule } from './main/services/event-groups/event-groups.module';
import { SchedulesModule } from './main/services/schedules/schedules.module';
import { PaymentsModule } from './main/services/payments/payments.module';
import { AppController } from './app.controller';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: AppConfigService.getDotenvConfigs()
        }),
        RouterModule.register(routes),
        TypeOrmModule.forRootAsync(AppConfigService.getDatabaseConfigs()),
        WinstonModule.forRootAsync(AppConfigService.getWinstonModuleSetting()),

        UserModule,

        AuthModule,

        EventGroupsModule,

        SchedulesModule,

        PaymentsModule
    ],
    controllers: [AppController],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: ClassSerializerInterceptor
        },
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter
        },
        {
            provide: APP_PIPE,
            useFactory: () => new ValidationPipe({ transform: true })
        }
    ]
})
export class AppModule {}
