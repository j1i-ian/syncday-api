import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '@services/users/user.module';
import { JwtStrategy } from './strategies/jwt/jwt.strategy';
import { LocalStrategy } from './strategies/local/local.strategy';
import { TokenModule } from './tokens/token.module';
import { VerificationModule } from './verifications/verification.module';

@Module({
    imports: [ConfigModule, PassportModule, UserModule, TokenModule, VerificationModule],
    providers: [LocalStrategy, JwtStrategy]
})
export class AuthModule {}
