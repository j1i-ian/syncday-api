import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '@services/users/user.module';
import { LocalStrategy } from './strategy/local/local.strategy';
import { TokenModule } from './token/token.module';
import { AuthService } from './auth.service';

@Module({
    imports: [ConfigModule, PassportModule, UserModule, TokenModule],
    providers: [AuthService, LocalStrategy],
    exports: [AuthService]
})
export class AuthModule {}
