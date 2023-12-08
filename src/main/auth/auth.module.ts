import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '@services/users/user.module';
import { JwtStrategy } from './strategy/jwt/jwt.strategy';
import { LocalStrategy } from './strategy/local/local.strategy';
import { TokenModule } from './token/token.module';
import { VerificationModule } from './verification/verification.module';

@Module({
    imports: [ConfigModule, PassportModule, UserModule, TokenModule, VerificationModule],
    providers: [LocalStrategy, JwtStrategy]
})
export class AuthModule {}
