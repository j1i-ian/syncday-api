import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '@services/users/user.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt/jwt.strategy';
import { LocalStrategy } from './strategy/local/local.strategy';
import { TokenModule } from './token/token.module';

@Module({
    imports: [ConfigModule, PassportModule, UserModule, TokenModule],
    providers: [AuthService, LocalStrategy, JwtStrategy],
    exports: [AuthService]
})
export class AuthModule {}
