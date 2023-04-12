import { ClassSerializerInterceptor, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { AwsSdkModule } from 'nest-aws-sdk';
import { routes } from '@config/routes';
import { AppConfigService } from '@config/app-config.service';
import { UserModule } from '@services/users/user.module';
import { GlobalExceptionFilter } from '@app/filters/global-exception.filter';
import { ClusterModule } from '@liaoliaots/nestjs-redis';
import { MailerModule } from '@nestjs-modules/mailer';
import { AppController } from './app.controller';
import { AuthModule } from './main/auth/auth.module';
import { JwtAuthGuard } from './main/auth/strategy/jwt/jwt-auth.guard';
import { EventGroupsModule } from './main/services/event-groups/event-groups.module';
import { PaymentsModule } from './main/services/payments/payments.module';
import { SchedulesModule } from './main/services/schedules/schedules.module';
import { UtilModule } from './main/services/util/util.module';
import { IntegrationsModule } from './main/services/integrations/integrations.module';
import { WorkspacesModule } from './main/services/workspaces/workspaces.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: AppConfigService.getDotenvConfigs()
        }),
        RouterModule.register(routes),
        TypeOrmModule.forRootAsync(AppConfigService.getDatabaseConfigs()),
        WinstonModule.forRootAsync(AppConfigService.getWinstonModuleSetting()),
        ClusterModule.forRootAsync(AppConfigService.getRedisModuleOptions()),
        AwsSdkModule.forRootAsync(AppConfigService.getAWSSDKOptions()),
        MailerModule.forRootAsync(AppConfigService.getNodeMailerModuleOptions()),

        UserModule,

        AuthModule,

        EventGroupsModule,

        SchedulesModule,

        PaymentsModule,

        UtilModule,

        IntegrationsModule,

        WorkspacesModule
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
            provide: APP_GUARD,
            useClass: JwtAuthGuard
        },
        {
            provide: APP_PIPE,
            useFactory: () => new ValidationPipe({ transform: true })
        }
    ]
})
export class AppModule {}
