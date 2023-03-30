import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '@config/app-config.service';
import { UserModule } from '@services/users/user.module';
import { LocalStrategy } from './strategy/local/local.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
    imports: [
        ConfigModule,
        PassportModule,
        JwtModule.registerAsync(AppConfigService.getJwtOptions()),

        UserModule
    ],
    controllers: [AuthController],
    providers: [AuthService, LocalStrategy]
})
export class AuthModule {}
