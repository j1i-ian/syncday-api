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
